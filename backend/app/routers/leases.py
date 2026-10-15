import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response
from typing import Optional, List
from app.db import get_db
from app.services.csv_importer import parse_lease_csv, generate_csv_template
from app.services.kml_service import generate_kml_for_analysis, get_google_earth_web_url
from shapely.geometry import shape

router = APIRouter(prefix="/api/leases", tags=["Leases"])

@router.get("")
def list_leases():
    """List all registered mining leases in Punjab."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, lease_id, quarry_name, mineral, district, company_name, lease_status, lease_area_ha, calculated_area_ha, created_at
    FROM leases
    ORDER BY id ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    leases = []
    for r in rows:
        leases.append({
            "id": r["id"],
            "lease_id": r["lease_id"],
            "quarry_name": r["quarry_name"],
            "mineral": r["mineral"],
            "district": r["district"],
            "company_name": r["company_name"],
            "lease_status": r["lease_status"],
            "lease_area_ha": r["lease_area_ha"],
            "calculated_area_ha": r["calculated_area_ha"],
            "created_at": r["created_at"]
        })
    return {"leases": leases}

@router.get("/{lease_id}")
def get_lease_details(lease_id: str):
    """Get single lease with full boundary and 1km buffer GeoJSON geometries."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM leases WHERE lease_id = ?
    """, (lease_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail=f"Lease {lease_id} not found")

    boundary_geojson = json.loads(row["boundary_geojson"])
    monitoring_zone_geojson = json.loads(row["monitoring_zone_geojson"]) if row["monitoring_zone_geojson"] else None

    # Compute bounding box & centroid
    poly = shape(boundary_geojson)
    minx, miny, maxx, maxy = poly.bounds
    centroid = [poly.centroid.y, poly.centroid.x]

    ge_url = get_google_earth_web_url(poly.centroid.y, poly.centroid.x)

    return {
        "id": row["id"],
        "lease_id": row["lease_id"],
        "quarry_name": row["quarry_name"],
        "mineral": row["mineral"],
        "district": row["district"],
        "company_name": row["company_name"],
        "lease_status": row["lease_status"],
        "lease_area_ha": row["lease_area_ha"],
        "calculated_area_ha": row["calculated_area_ha"],
        "boundary_geojson": boundary_geojson,
        "monitoring_zone_geojson": monitoring_zone_geojson,
        "centroid": centroid,
        "bounds": [[miny, minx], [maxy, maxx]],
        "google_earth_url": ge_url,
        "created_at": row["created_at"]
    }

@router.post("/import-csv")
async def import_csv_file(
    file: Optional[UploadFile] = File(None),
    csv_text: Optional[str] = Form(None),
    commit: bool = Form(True)
):
    """
    Import lease coordinates from uploaded CSV file or pasted CSV text.
    Handles Format A (WKT/GeoJSON) and Format B (Multi-row Lat/Lon vertices).
    """
    if file:
        content_bytes = await file.read()
        content = content_bytes.decode('utf-8', errors='replace')
    elif csv_text:
        content = csv_text
    else:
        raise HTTPException(status_code=400, detail="Provide either a CSV file or csv_text form parameter.")

    result = parse_lease_csv(content, commit_to_db=commit)
    return result

@router.get("/template/download")
def download_template(format: str = "FORMAT_B"):
    """Download standard CSV template for lease import."""
    csv_str = generate_csv_template(format)
    filename = f"ai_mims_template_{format.lower()}.csv"
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/reset-demo-leases")
def reset_demo_leases():
    """Initializes or resets database with Punjab demonstration quarries."""
    template_b = generate_csv_template("FORMAT_B")
    parse_lease_csv(template_b, commit_to_db=True)
    template_a = generate_csv_template("FORMAT_A")
    parse_lease_csv(template_a, commit_to_db=True)
    return {"message": "Demo leases seeded successfully in Punjab, Pakistan."}
