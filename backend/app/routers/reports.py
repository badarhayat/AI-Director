import os
import json
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from app.db import get_db
from app.config import REPORTS_DIR
from app.services.report_service import build_pdf_report
from app.services.kml_service import generate_kml_for_analysis

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("/{analysis_id}/download")
def download_pdf_report(analysis_id: str):
    """Streams downloadable PDF inspection report for the specified analysis."""
    pdf_path = REPORTS_DIR / f"{analysis_id}.pdf"

    if not pdf_path.exists():
        # Try generating it on-the-fly from database record
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,))
        a_row = cursor.fetchone()
        if not a_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Analysis record not found")

        cursor.execute("SELECT * FROM leases WHERE lease_id = ?", (a_row["lease_id"],))
        l_row = cursor.fetchone()
        conn.close()

        if not l_row:
            raise HTTPException(status_code=404, detail="Associated lease not found")

        try:
            build_pdf_report(dict(a_row), dict(l_row), output_path=str(pdf_path))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to build PDF: {str(e)}")

    return FileResponse(
        path=str(pdf_path),
        filename=f"AI_MIMS_Inspection_Report_{analysis_id}.pdf",
        media_type="application/pdf"
    )

@router.get("/{analysis_id}/kml")
def download_kml_export(analysis_id: str):
    """Exports official lease boundary, 1km buffer, and change polygons as Google Earth KML."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,))
    a_row = cursor.fetchone()
    if not a_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Analysis record not found")

    cursor.execute("SELECT * FROM leases WHERE lease_id = ?", (a_row["lease_id"],))
    l_row = cursor.fetchone()

    cursor.execute("SELECT * FROM detected_polygons WHERE analysis_id = ?", (analysis_id,))
    poly_rows = cursor.fetchall()
    conn.close()

    if not l_row:
        raise HTTPException(status_code=404, detail="Associated lease not found")

    lease_data = {
        "lease_id": l_row["lease_id"],
        "quarry_name": l_row["quarry_name"],
        "mineral": l_row["mineral"],
        "district": l_row["district"],
        "lease_area_ha": l_row["lease_area_ha"],
        "boundary_geojson": json.loads(l_row["boundary_geojson"])
    }
    monitoring_zone_geojson = json.loads(l_row["monitoring_zone_geojson"]) if l_row["monitoring_zone_geojson"] else None

    inside_features = []
    outside_features = []
    for pr in poly_rows:
        feat = {
            "type": "Feature",
            "properties": {
                "category": pr["category"],
                "feature_type": pr["feature_type"],
                "area_ha": pr["area_ha"],
                "area_sqm": pr["area_sqm"],
                "distance_m": 120.0 if pr["is_outside_lease"] else 0.0,
                "verification_status": pr["verification_status"] or "CANDIDATE",
                "inspector_notes": pr["inspector_notes"] or ""
            },
            "geometry": json.loads(pr["geojson_geometry"])
        }
        if pr["is_outside_lease"]:
            outside_features.append(feat)
        else:
            inside_features.append(feat)

    kml_str = generate_kml_for_analysis(
        lease_data=lease_data,
        analysis_data=dict(a_row),
        monitoring_zone_geojson=monitoring_zone_geojson,
        features_geojson={"inside": inside_features, "outside": outside_features}
    )

    filename = f"AI_MIMS_{a_row['lease_id']}_{analysis_id}.kml"
    return Response(
        content=kml_str,
        media_type="application/vnd.google-earth.kml+xml",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
