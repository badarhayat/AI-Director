import json
import uuid
import io
import os
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.db import get_db
from app.config import UPLOADS_DIR
from app.services.imagery_service import ImageryProvider
from app.services.change_detection import run_change_detection_pipeline
from app.services.mineral_service import get_mineral_density, calculate_production_estimates
from app.services.report_service import build_pdf_report
from shapely.geometry import shape

router = APIRouter(prefix="/api/analysis", tags=["Analysis"])

class RunAnalysisRequest(BaseModel):
    lease_id: str
    start_date: str = "2024-01-15"
    end_date: str = "2024-10-10"
    imagery_source: str = "Copernicus Sentinel-2 L2A"
    assumed_depth_m: Optional[float] = None
    override_density: Optional[float] = None

class UpdateReviewRequest(BaseModel):
    review_status: str
    reviewer_remarks: Optional[str] = None

class FeatureVerificationRequest(BaseModel):
    feature_id: str
    status: str  # 'CONFIRMED', 'REJECTED', 'FIELD_VERIFY', 'CANDIDATE'
    inspector_notes: Optional[str] = ""
    inspector_name: Optional[str] = "DGM&M Mining Inspector"

@router.post("/run")
def run_lease_analysis(req: RunAnalysisRequest):
    """
    Date-Driven One-Click Analysis Workflow:
    1. Validates that end_date >= start_date.
    2. Loads stored official lease polygon and generates 1,000m projected UTM 43N buffer.
    3. Acquires satellite imagery for T1 (start_date) and T2 (end_date) using live Sentinel-2 STAC or calibrated simulation.
    4. Computes multispectral surface change differencing and NDVI vegetation loss.
    5. Calculates inside-lease authorized excavation vs outside-lease potential encroachment in projected UTM 43N.
    6. Produces cartographic map overlays and saves persistent PNG images.
    7. Compiles government-grade 2-page PDF inspection dossier.
    8. Records all results in SQLite database.
    """
    # 1. Date Validation
    try:
        d_start = datetime.strptime(req.start_date, "%Y-%m-%d")
        d_end = datetime.strptime(req.end_date, "%Y-%m-%d")
        if d_end < d_start:
            raise HTTPException(status_code=400, detail="End date must be later than or equal to Start date.")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM leases WHERE lease_id = ?", (req.lease_id,))
    lease_row = cursor.fetchone()

    if not lease_row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Lease {req.lease_id} not found.")

    lease_boundary = json.loads(lease_row["boundary_geojson"])
    monitoring_zone = json.loads(lease_row["monitoring_zone_geojson"]) if lease_row["monitoring_zone_geojson"] else None

    # Unique analysis identifier incorporating date window
    ts = datetime.now().strftime('%Y%m%d%H%M%S')
    clean_s = req.start_date.replace('-', '')
    clean_e = req.end_date.replace('-', '')
    analysis_id = f"AIMIMS-{req.lease_id}-{clean_s}_{clean_e}-{ts}"
    now_iso = datetime.utcnow().isoformat()

    # 2. Acquire Satellite Imagery Pair (T1 & T2)
    bands_before, bands_after, extent_meta, sat_meta = ImageryProvider.acquire_imagery_pair(
        lease_boundary, req.start_date, req.end_date, width=512, height=512
    )

    # 3. Run Change Detection & Cartographic Map Generation
    change_res = run_change_detection_pipeline(
        bands_before, bands_after, extent_meta, lease_boundary, sat_meta, analysis_id
    )

    # 4. Geotechnical Mineral Density & Production Estimation
    mineral_name = lease_row["mineral"]
    mineral_info = get_mineral_density(mineral_name)
    density_val = req.override_density if req.override_density else mineral_info["in_situ_bulk_density"]

    prod_estimates = calculate_production_estimates(
        excavation_area_sqm=change_res["total_disturbance_sqm"],
        density_t_per_m3=density_val,
        assumed_depth_m=req.assumed_depth_m
    )

    is_demo_flag = 1 if sat_meta.get("is_demonstration_source", True) else 0

    # 5. Save Analysis Record to Database
    cursor.execute("""
    INSERT INTO analyses (
        id, lease_id, start_date, end_date, actual_start_date, actual_end_date,
        imagery_source, resolution_m, total_disturbance_ha, total_disturbance_sqm,
        inside_disturbance_ha, inside_disturbance_sqm, outside_disturbance_ha, outside_disturbance_sqm,
        encroachment_pct, change_pct_of_lease, new_benches_status, stockpile_change_ha,
        haul_roads_km, ndvi_loss_ha, water_change_ha, volume_m3, density_t_per_m3,
        mass_tonnes, production_notes, is_demo, review_status, reviewer_remarks,
        report_pdf_path, map_image_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        analysis_id,
        req.lease_id,
        req.start_date,
        req.end_date,
        sat_meta["actual_start_date"],
        sat_meta["actual_end_date"],
        sat_meta["imagery_source"],
        sat_meta["resolution_m"],
        change_res["total_disturbance_ha"],
        change_res["total_disturbance_sqm"],
        change_res["inside_disturbance_ha"],
        change_res["inside_disturbance_sqm"],
        change_res["outside_disturbance_ha"],
        change_res["outside_disturbance_sqm"],
        change_res["encroachment_pct"],
        change_res["change_pct_of_lease"],
        "Resolution limitation: individual bench crests require sub-meter imagery (<0.5m)",
        change_res["stockpile_change_ha"],
        change_res["haul_roads_km"],
        change_res["vegetation_loss_ha"],
        change_res["water_change_ha"],
        prod_estimates["volume_m3"],
        density_val,
        prod_estimates["excavated_mass_tonnes"],
        prod_estimates["volume_note"],
        is_demo_flag,
        "PENDING_REVIEW",
        "Automated satellite analysis completed for period " + req.start_date + " to " + req.end_date,
        f"{analysis_id}.pdf",
        f"{analysis_id}_overlay.png",
        now_iso
    ))

    # Save all candidate features to detected_polygons table
    all_feats = change_res["features"].get("all_features", [])
    if not all_feats:
        all_feats = change_res["features"].get("inside", []) + change_res["features"].get("outside", [])

    for f in all_feats:
        props = f.get("properties", {})
        is_outside = 1 if props.get("category") == "POTENTIAL_ENCROACHMENT" or props.get("is_outside") else 0
        cursor.execute("""
        INSERT INTO detected_polygons (
            analysis_id, category, feature_type, area_sqm, area_ha,
            geojson_geometry, is_outside_lease, confidence,
            verification_status, inspector_notes, verified_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            analysis_id,
            props.get("category", "INSIDE_EXCAVATION"),
            props.get("feature_type", "Detected Disturbance"),
            props.get("area_sqm", 0.0),
            props.get("area_ha", 0.0),
            json.dumps(f["geometry"]),
            is_outside,
            props.get("confidence", 0.88),
            props.get("verification_status", "CANDIDATE"),
            props.get("inspector_notes", ""),
            None
        ))
        # attach db id
        props["db_id"] = cursor.lastrowid

    conn.commit()
    conn.close()

    # 6. Generate Official PDF Inspection Dossier
    lease_dict = dict(lease_row)
    analysis_dict = {
        "id": analysis_id,
        "lease_id": req.lease_id,
        "actual_start_date": sat_meta["actual_start_date"],
        "actual_end_date": sat_meta["actual_end_date"],
        "imagery_source": sat_meta["imagery_source"],
        "total_disturbance_ha": change_res["total_disturbance_ha"],
        "total_disturbance_sqm": change_res["total_disturbance_sqm"],
        "inside_disturbance_ha": change_res["inside_disturbance_ha"],
        "inside_disturbance_sqm": change_res["inside_disturbance_sqm"],
        "outside_disturbance_ha": change_res["outside_disturbance_ha"],
        "outside_disturbance_sqm": change_res["outside_disturbance_sqm"],
        "change_pct_of_lease": change_res["change_pct_of_lease"],
        "encroachment_pct": change_res["encroachment_pct"],
        "stockpile_change_ha": change_res["stockpile_change_ha"],
        "haul_roads_km": change_res["haul_roads_km"],
        "ndvi_loss_ha": change_res["vegetation_loss_ha"],
        "water_change_ha": change_res["water_change_ha"],
        "volume_m3": prod_estimates["volume_m3"],
        "density_t_per_m3": density_val,
        "mass_tonnes": prod_estimates["excavated_mass_tonnes"],
        "is_demo": bool(is_demo_flag),
        "review_status": "PENDING_REVIEW",
        "before_path": change_res["before_path"],
        "after_path": change_res["after_path"],
        "overlay_path": change_res["overlay_path"],
        "rgb_before_b64": change_res["rgb_before_b64"],
        "rgb_after_b64": change_res["rgb_after_b64"],
        "rgb_overlay_b64": change_res["rgb_overlay_b64"]
    }

    try:
        build_pdf_report(analysis_dict, lease_dict)
    except Exception as e:
        print(f"Warning: PDF generation failed during run: {e}")

    return {
        "analysis_id": analysis_id,
        "lease_id": req.lease_id,
        "lease_info": {
            "quarry_name": lease_row["quarry_name"],
            "mineral": lease_row["mineral"],
            "district": lease_row["district"],
            "company_name": lease_row["company_name"],
            "lease_area_ha": lease_row["lease_area_ha"],
            "calculated_area_ha": lease_row["calculated_area_ha"],
            "boundary_geojson": lease_boundary,
            "monitoring_zone_geojson": monitoring_zone
        },
        "satellite_metadata": sat_meta,
        "metrics": {
            "total_disturbance_ha": change_res["total_disturbance_ha"],
            "total_disturbance_sqm": change_res["total_disturbance_sqm"],
            "inside_disturbance_ha": change_res["inside_disturbance_ha"],
            "inside_disturbance_sqm": change_res["inside_disturbance_sqm"],
            "outside_disturbance_ha": change_res["outside_disturbance_ha"],
            "outside_disturbance_sqm": change_res["outside_disturbance_sqm"],
            "change_pct_of_lease": change_res["change_pct_of_lease"],
            "encroachment_pct": change_res["encroachment_pct"],
            "stockpile_change_ha": change_res["stockpile_change_ha"],
            "haul_roads_km": change_res["haul_roads_km"],
            "vegetation_loss_ha": change_res["vegetation_loss_ha"],
            "water_change_ha": change_res["water_change_ha"],
            "encroachment_alert": change_res["outside_disturbance_ha"] > 0
        },
        "production_estimates": prod_estimates,
        "features": change_res["features"],
        "imagery_previews": {
            "rgb_before_b64": change_res["rgb_before_b64"],
            "rgb_after_b64": change_res["rgb_after_b64"],
            "rgb_overlay_b64": change_res["rgb_overlay_b64"],
            "bounds": change_res["bounds"]
        },
        "report_pdf_url": f"/api/reports/{analysis_id}/download",
        "kml_url": f"/api/reports/{analysis_id}/kml",
        "created_at": now_iso
    }

@router.get("/all")
def get_all_analyses():
    """Retrieve all analyses for dashboard KPIs and reporting history."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT a.*, l.quarry_name, l.mineral, l.district, l.company_name
    FROM analyses a
    LEFT JOIN leases l ON a.lease_id = l.lease_id
    ORDER BY a.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    items = []
    for r in rows:
        items.append(dict(r))
    return {"analyses": items}

@router.get("/history/{lease_id}")
def get_lease_history(lease_id: str):
    """Retrieve historical analyses for a specific lease."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM analyses WHERE lease_id = ? ORDER BY created_at DESC
    """, (lease_id,))
    rows = cursor.fetchall()
    conn.close()
    return {"history": [dict(r) for r in rows]}

@router.patch("/{analysis_id}/review")
def update_analysis_review(analysis_id: str, req: UpdateReviewRequest):
    """Update inspector review status (e.g. VERIFIED, REQUIRES_FIELD_INSPECTION) and notes."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE analyses
    SET review_status = ?, reviewer_remarks = ?
    WHERE id = ?
    """, (req.review_status, req.reviewer_remarks, analysis_id))
    conn.commit()
    conn.close()
    return {"message": "Review status updated successfully"}

@router.post("/{analysis_id}/verify-feature")
def verify_candidate_feature(analysis_id: str, req: FeatureVerificationRequest):
    """
    Inspector Verification Action:
    Allows inspector to confirm, reject, or mark a candidate feature for field verification.
    """
    conn = get_db()
    cursor = conn.cursor()
    now_iso = datetime.utcnow().isoformat() + "Z"

    # Match by numeric db_id or feature_id
    feat_id_clean = req.feature_id.strip()
    updated = False

    if feat_id_clean.isdigit():
        cursor.execute("""
        UPDATE detected_polygons
        SET verification_status = ?, inspector_notes = ?, verified_at = ?
        WHERE analysis_id = ? AND id = ?
        """, (req.status, req.inspector_notes, now_iso, analysis_id, int(feat_id_clean)))
        if cursor.rowcount > 0:
            updated = True

    if not updated:
        # Match by FEAT-xxx pattern or category
        cursor.execute("""
        UPDATE detected_polygons
        SET verification_status = ?, inspector_notes = ?, verified_at = ?
        WHERE analysis_id = ? AND (
            feature_type LIKE ? OR category LIKE ? OR id = ?
        )
        """, (
            req.status,
            req.inspector_notes,
            now_iso,
            analysis_id,
            f"%{feat_id_clean}%",
            f"%{feat_id_clean}%",
            int(feat_id_clean.replace("FEAT-", "")) if feat_id_clean.replace("FEAT-", "").isdigit() else -1
        ))

    conn.commit()

    # Get updated breakdown
    cursor.execute("""
    SELECT verification_status, COUNT(*) as cnt
    FROM detected_polygons
    WHERE analysis_id = ?
    GROUP BY verification_status
    """, (analysis_id,))
    summary = {r["verification_status"]: r["cnt"] for r in cursor.fetchall()}
    conn.close()

    return {
        "status": "success",
        "analysis_id": analysis_id,
        "feature_id": req.feature_id,
        "verification_status": req.status,
        "verified_at": now_iso,
        "summary": summary
    }

@router.get("/{analysis_id}/features")
def get_analysis_features(analysis_id: str):
    """Retrieves all detected features for the analysis with real-time inspector verification status."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM detected_polygons WHERE analysis_id = ? ORDER BY id ASC
    """, (analysis_id,))
    rows = cursor.fetchall()
    conn.close()

    features = []
    for idx, r in enumerate(rows, start=1):
        color_map = {
            "INSIDE_EXCAVATION": "#DC2626",
            "POTENTIAL_ENCROACHMENT": "#EF4444",
            "CANDIDATE_BENCH": "#7C3AED",
            "STOCKPILE": "#F97316",
            "HAUL_ROAD": "#EAB308",
            "VEGETATION_LOSS": "#EC4899"
        }
        features.append({
            "type": "Feature",
            "id": f"FEAT-{r['id']:03d}",
            "properties": {
                "id": f"FEAT-{r['id']:03d}",
                "db_id": r["id"],
                "category": r["category"],
                "feature_type": r["feature_type"],
                "area_ha": r["area_ha"],
                "area_sqm": r["area_sqm"],
                "confidence": r["confidence"],
                "color": color_map.get(r["category"], "#DC2626"),
                "is_outside": bool(r["is_outside_lease"]),
                "verification_status": r["verification_status"] or "CANDIDATE",
                "inspector_notes": r["inspector_notes"] or "",
                "verified_at": r["verified_at"]
            },
            "geometry": json.loads(r["geojson_geometry"])
        })

    return {
        "analysis_id": analysis_id,
        "features": features,
        "count": len(features)
    }

@router.post("/import-kml")
async def import_kml_layer(file: UploadFile = File(...), lease_id: Optional[str] = Form(None)):
    """
    Parses an uploaded OGC KML or KMZ inspection file, saves it to imported_layers,
    and returns georeferenced GeoJSON geometries for overlay.
    """
    content = await file.read()
    filename = file.filename or "imported_layer.kml"
    kml_text = ""

    if filename.lower().endswith(".kmz"):
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                # find doc.kml or first .kml file
                kml_names = [n for n in z.namelist() if n.lower().endswith(".kml")]
                if not kml_names:
                    raise HTTPException(status_code=400, detail="No KML document found inside KMZ archive")
                kml_text = z.read(kml_names[0]).decode("utf-8", errors="ignore")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read KMZ archive: {str(e)}")
    else:
        kml_text = content.decode("utf-8", errors="ignore")

    # Parse KML XML
    try:
        root = ET.fromstring(kml_text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid KML XML structure: {str(e)}")

    features = []
    for elem in root.iter():
        if elem.tag.endswith("Placemark"):
            name = ""
            desc = ""
            geom = None
            for child in elem:
                if child.tag.endswith("name"):
                    name = child.text or ""
                elif child.tag.endswith("description"):
                    desc = child.text or ""
                elif child.tag.endswith("Polygon"):
                    for sub in child.iter():
                        if sub.tag.endswith("coordinates") and sub.text:
                            ring = []
                            for pt in sub.text.strip().split():
                                parts = pt.split(",")
                                if len(parts) >= 2:
                                    try:
                                        ring.append([float(parts[0]), float(parts[1])])
                                    except ValueError:
                                        continue
                            if len(ring) >= 3:
                                geom = {"type": "Polygon", "coordinates": [ring]}
                            break
                elif child.tag.endswith("LineString"):
                    for sub in child.iter():
                        if sub.tag.endswith("coordinates") and sub.text:
                            line = []
                            for pt in sub.text.strip().split():
                                parts = pt.split(",")
                                if len(parts) >= 2:
                                    try:
                                        line.append([float(parts[0]), float(parts[1])])
                                    except ValueError:
                                        continue
                            if len(line) >= 2:
                                geom = {"type": "LineString", "coordinates": line}
                            break
                elif child.tag.endswith("Point"):
                    for sub in child.iter():
                        if sub.tag.endswith("coordinates") and sub.text:
                            parts = sub.text.strip().split(",")
                            if len(parts) >= 2:
                                try:
                                    geom = {"type": "Point", "coordinates": [float(parts[0]), float(parts[1])]}
                                except ValueError:
                                    pass
                            break

            if geom:
                features.append({
                    "type": "Feature",
                    "properties": {
                        "name": name or "Imported Inspection Placemark",
                        "description": desc,
                        "source": filename
                    },
                    "geometry": geom
                })

    geojson_fc = {
        "type": "FeatureCollection",
        "features": features
    }

    # Save record into imported_layers
    now_iso = datetime.utcnow().isoformat() + "Z"
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO imported_layers (
        lease_id, layer_name, layer_type, acquisition_date,
        source_description, file_path, geojson_data, bounds_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        lease_id or "GENERAL",
        filename,
        "KML",
        None,
        f"Imported inspection vector layer: {filename}",
        None,
        json.dumps(geojson_fc),
        None,
        now_iso
    ))
    layer_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "layer_id": layer_id,
        "layer_name": filename,
        "feature_count": len(features),
        "geojson": geojson_fc
    }

@router.post("/import-georeferenced-image")
async def import_georeferenced_image(
    file: UploadFile = File(...),
    lease_id: str = Form(...),
    acquisition_date: str = Form(...),
    imagery_source: str = Form(...),
    north_lat: float = Form(...),
    south_lat: float = Form(...),
    east_lon: float = Form(...),
    west_lon: float = Form(...),
    notes: Optional[str] = Form("")
):
    """
    Imports historical imagery exported from Google Earth Pro or other authorized source.
    Requires explicit bounding coordinates (North, South, East, West).
    Screenshots without georeferencing bounds are strictly rejected for area calculations.
    """
    if south_lat >= north_lat or west_lon >= east_lon:
        raise HTTPException(status_code=400, detail="Invalid bounding coordinates: North must be > South and East must be > West.")

    content = await file.read()
    ext = Path(file.filename or "image.png").suffix or ".png"
    unique_filename = f"ge_hist_{uuid.uuid4().hex[:10]}{ext}"
    dest_path = UPLOADS_DIR / unique_filename

    with open(dest_path, "wb") as f:
        f.write(content)

    bounds = [
        [south_lat, west_lon],
        [north_lat, east_lon]
    ]

    now_iso = datetime.utcnow().isoformat() + "Z"
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO imported_layers (
        lease_id, layer_name, layer_type, acquisition_date,
        source_description, file_path, geojson_data, bounds_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        lease_id,
        file.filename or "Historical Imagery",
        "GEOREFERENCED_IMAGE",
        acquisition_date,
        f"{imagery_source} ({notes})" if notes else imagery_source,
        str(dest_path),
        None,
        json.dumps(bounds),
        now_iso
    ))
    layer_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "layer_id": layer_id,
        "lease_id": lease_id,
        "acquisition_date": acquisition_date,
        "imagery_source": imagery_source,
        "bounds": bounds,
        "image_url": f"/api/analysis/imported-image/{layer_id}",
        "disclaimer": "Imported historical imagery is calibrated for visual comparison only. Regulatory area calculations use projected satellite vectors."
    }

@router.get("/imported-image/{layer_id}")
def get_imported_image(layer_id: int):
    """Serves an uploaded historical georeferenced image file."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT file_path FROM imported_layers WHERE id = ?", (layer_id,))
    row = cursor.fetchone()
    conn.close()

    if not row or not row["file_path"]:
        raise HTTPException(status_code=404, detail="Image layer not found")

    file_path = Path(row["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Underlying image file missing on disk")

    return FileResponse(path=str(file_path))

@router.get("/imported-layers/{lease_id}")
def get_imported_layers(lease_id: str):
    """Retrieves all imported KML and historical raster layers for a lease."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, lease_id, layer_name, layer_type, acquisition_date, source_description, bounds_json, geojson_data, created_at
    FROM imported_layers
    WHERE lease_id = ? OR lease_id = 'GENERAL'
    ORDER BY created_at DESC
    """, (lease_id,))
    rows = cursor.fetchall()
    conn.close()

    layers = []
    for r in rows:
        layers.append({
            "id": r["id"],
            "lease_id": r["lease_id"],
            "layer_name": r["layer_name"],
            "layer_type": r["layer_type"],
            "acquisition_date": r["acquisition_date"],
            "source_description": r["source_description"],
            "bounds": json.loads(r["bounds_json"]) if r["bounds_json"] else None,
            "geojson": json.loads(r["geojson_data"]) if r["geojson_data"] else None,
            "image_url": f"/api/analysis/imported-image/{r['id']}" if r["layer_type"] == "GEOREFERENCED_IMAGE" else None,
            "created_at": r["created_at"]
        })

    return {"layers": layers}
