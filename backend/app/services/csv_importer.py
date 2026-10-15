import csv
import io
import json
import re
from typing import Dict, Any, List, Tuple
from shapely import wkt
from shapely.geometry import mapping, Polygon
from app.services.gis_service import (
    validate_and_close_polygon,
    calculate_projected_area,
    create_monitoring_buffer
)
from app.db import get_db

def normalize_header(header: str) -> str:
    """Normalize column header to snake_case lowercase."""
    return re.sub(r'[\s\-_]+', '_', header.strip().lower())

def detect_csv_format(headers: List[str]) -> str:
    """Detect if CSV is Format A (one row per lease with WKT/GeoJSON) or Format B (vertices)."""
    norm_headers = [normalize_header(h) for h in headers]
    if any(h in norm_headers for h in ["latitude", "lat", "vertex_order", "order"]):
        return "FORMAT_B"
    if any(h in norm_headers for h in ["boundary_wkt", "wkt", "geometry", "geojson", "boundary_geojson"]):
        return "FORMAT_A"
    return "UNKNOWN"

def parse_lease_csv(file_content: str, commit_to_db: bool = False) -> Dict[str, Any]:
    """
    Parses CSV content in Format A or Format B.
    Validates geometries, calculates projected area in hectares,
    compares with claimed area, generates 1km monitoring zone, and optionally saves to DB.
    """
    reader = csv.reader(io.StringIO(file_content))
    raw_rows = list(reader)
    if not raw_rows:
        return {"success": False, "error": "CSV file is empty"}

    raw_headers = raw_rows[0]
    headers = [normalize_header(h) for h in raw_headers]
    data_rows = raw_rows[1:]

    fmt = detect_csv_format(headers)
    if fmt == "UNKNOWN":
        return {
            "success": False,
            "error": "Could not automatically determine CSV format. Please include latitude/longitude/vertex_order (Format B) or boundary_wkt (Format A)."
        }

    header_map = {norm: idx for idx, norm in enumerate(headers)}
    processed_leases = []
    errors = []
    warnings = []

    if fmt == "FORMAT_B":
        # Multi-row format: group by lease_id
        lease_groups: Dict[str, Dict[str, Any]] = {}
        lat_idx = header_map.get("latitude", header_map.get("lat"))
        lon_idx = header_map.get("longitude", header_map.get("lon", header_map.get("lng")))
        order_idx = header_map.get("vertex_order", header_map.get("order"))
        id_idx = header_map.get("lease_id", header_map.get("id"))
        quarry_idx = header_map.get("quarry_name", header_map.get("quarry"))
        mineral_idx = header_map.get("mineral")
        district_idx = header_map.get("district")
        company_idx = header_map.get("company_name", header_map.get("company"))
        area_idx = header_map.get("lease_area_ha", header_map.get("area_ha", header_map.get("area")))

        if lat_idx is None or lon_idx is None or id_idx is None:
            return {"success": False, "error": "Format B requires columns: lease_id, latitude, longitude"}

        for row_num, row in enumerate(data_rows, start=2):
            if not any(row):
                continue
            try:
                lid = row[id_idx].strip()
                if not lid:
                    continue
                lat = float(row[lat_idx].strip())
                lon = float(row[lon_idx].strip())
                order = int(float(row[order_idx].strip())) if order_idx is not None and row[order_idx].strip() else 0

                if lid not in lease_groups:
                    lease_groups[lid] = {
                        "lease_id": lid,
                        "quarry_name": row[quarry_idx].strip() if quarry_idx is not None and len(row) > quarry_idx else f"Quarry {lid}",
                        "mineral": row[mineral_idx].strip() if mineral_idx is not None and len(row) > mineral_idx else "Limestone",
                        "district": row[district_idx].strip() if district_idx is not None and len(row) > district_idx else "Punjab",
                        "company_name": row[company_idx].strip() if company_idx is not None and len(row) > company_idx else "Licensed Operator",
                        "claimed_area_ha": float(row[area_idx].strip()) if area_idx is not None and len(row) > area_idx and row[area_idx].strip() else None,
                        "vertices": []
                    }
                lease_groups[lid]["vertices"].append((order, (lon, lat), row_num))
            except Exception as e:
                errors.append(f"Row {row_num}: Failed to parse vertex: {str(e)}")

        # Process each grouped lease
        for lid, info in lease_groups.items():
            # Sort vertices by order
            sorted_verts = sorted(info["vertices"], key=lambda v: v[0])
            coords = [v[1] for v in sorted_verts]

            poly, auto_closed, geom_err = validate_and_close_polygon(coords)
            if geom_err:
                errors.append(f"Lease {lid}: {geom_err}")
                continue

            if auto_closed:
                warnings.append(f"Lease {lid}: Boundary was not explicitly closed; automatically connected vertex 1 to vertex {len(coords)}.")

            sqm, ha = calculate_projected_area(poly)
            claimed = info["claimed_area_ha"]
            discrepancy_pct = None
            if claimed and claimed > 0:
                discrepancy_pct = round(abs(ha - claimed) / claimed * 100, 2)
                if discrepancy_pct > 15.0:
                    warnings.append(f"Lease {lid}: Calculated area ({ha:.2f} ha) differs from stated area ({claimed:.2f} ha) by {discrepancy_pct}%.")

            # Create 1km monitoring zone
            _, monitoring_ring = create_monitoring_buffer(poly, 1000.0)

            processed_leases.append({
                "lease_id": lid,
                "quarry_name": info["quarry_name"],
                "mineral": info["mineral"],
                "district": info["district"],
                "company_name": info["company_name"],
                "lease_status": "ACTIVE",
                "lease_area_ha": claimed or round(ha, 2),
                "calculated_area_ha": round(ha, 4),
                "calculated_area_sqm": round(sqm, 2),
                "area_discrepancy_pct": discrepancy_pct,
                "boundary_geojson": mapping(poly),
                "monitoring_zone_geojson": mapping(monitoring_ring),
                "vertex_count": len(coords),
                "auto_closed": auto_closed
            })

    elif fmt == "FORMAT_A":
        # Format A: one row per lease
        id_idx = header_map.get("lease_id", header_map.get("id"))
        quarry_idx = header_map.get("quarry_name", header_map.get("quarry"))
        mineral_idx = header_map.get("mineral")
        district_idx = header_map.get("district")
        company_idx = header_map.get("company_name", header_map.get("company"))
        status_idx = header_map.get("lease_status", header_map.get("status"))
        area_idx = header_map.get("lease_area_ha", header_map.get("area_ha", header_map.get("area")))
        wkt_idx = header_map.get("boundary_wkt", header_map.get("wkt"))
        geojson_idx = header_map.get("boundary_geojson", header_map.get("geometry", header_map.get("geojson")))

        for row_num, row in enumerate(data_rows, start=2):
            if not any(row):
                continue
            try:
                lid = row[id_idx].strip() if id_idx is not None else f"LEASE-{row_num}"
                poly = None

                if wkt_idx is not None and row[wkt_idx].strip():
                    raw_geom = wkt.loads(row[wkt_idx].strip())
                    if isinstance(raw_geom, Polygon):
                        poly = raw_geom
                elif geojson_idx is not None and row[geojson_idx].strip():
                    geom_json = json.loads(row[geojson_idx].strip())
                    poly = Polygon(geom_json["coordinates"][0])

                if poly is None or not poly.is_valid:
                    errors.append(f"Row {row_num} (Lease {lid}): Invalid geometry or unsupported format.")
                    continue

                sqm, ha = calculate_projected_area(poly)
                claimed = float(row[area_idx].strip()) if area_idx is not None and row[area_idx].strip() else None
                discrepancy_pct = None
                if claimed and claimed > 0:
                    discrepancy_pct = round(abs(ha - claimed) / claimed * 100, 2)

                _, monitoring_ring = create_monitoring_buffer(poly, 1000.0)

                processed_leases.append({
                    "lease_id": lid,
                    "quarry_name": row[quarry_idx].strip() if quarry_idx is not None else f"Quarry {lid}",
                    "mineral": row[mineral_idx].strip() if mineral_idx is not None else "Limestone",
                    "district": row[district_idx].strip() if district_idx is not None else "Punjab",
                    "company_name": row[company_idx].strip() if company_idx is not None else "Licensed Mining Co",
                    "lease_status": row[status_idx].strip() if status_idx is not None else "ACTIVE",
                    "lease_area_ha": claimed or round(ha, 2),
                    "calculated_area_ha": round(ha, 4),
                    "calculated_area_sqm": round(sqm, 2),
                    "area_discrepancy_pct": discrepancy_pct,
                    "boundary_geojson": mapping(poly),
                    "monitoring_zone_geojson": mapping(monitoring_ring),
                    "vertex_count": len(poly.exterior.coords),
                    "auto_closed": False
                })
            except Exception as e:
                errors.append(f"Row {row_num}: Error processing lease: {str(e)}")

    # Database check and optional commit
    duplicates = []
    saved_count = 0
    conn = get_db()
    cursor = conn.cursor()

    for lease in processed_leases:
        cursor.execute("SELECT id, quarry_name FROM leases WHERE lease_id = ?", (lease["lease_id"],))
        existing = cursor.fetchone()
        if existing:
            duplicates.append(lease["lease_id"])
            lease["is_duplicate"] = True
        else:
            lease["is_duplicate"] = False

        if commit_to_db and not existing:
            from datetime import datetime
            now_iso = datetime.utcnow().isoformat()
            cursor.execute("""
            INSERT INTO leases (
                lease_id, quarry_name, mineral, district, company_name,
                lease_status, lease_area_ha, calculated_area_ha,
                boundary_geojson, monitoring_zone_geojson, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                lease["lease_id"],
                lease["quarry_name"],
                lease["mineral"],
                lease["district"],
                lease["company_name"],
                lease["lease_status"],
                lease["lease_area_ha"],
                lease["calculated_area_ha"],
                json.dumps(lease["boundary_geojson"]),
                json.dumps(lease["monitoring_zone_geojson"]),
                now_iso,
                now_iso
            ))
            saved_count += 1

    if commit_to_db:
        conn.commit()
    conn.close()

    return {
        "success": True,
        "format_detected": fmt,
        "total_parsed": len(processed_leases),
        "saved_count": saved_count,
        "duplicates": duplicates,
        "errors": errors,
        "warnings": warnings,
        "leases": processed_leases
    }

def generate_csv_template(format_type: str = "FORMAT_B") -> str:
    """Returns downloadable sample CSV template for users."""
    if format_type.upper() == "FORMAT_B":
        return """lease_id,quarry_name,mineral,district,company_name,vertex_order,latitude,longitude
DEMO-CKW-01,Chakwal Limestone Quarry,Limestone,Chakwal,Fauji Cement Ltd,1,32.9025,72.7150
DEMO-CKW-01,Chakwal Limestone Quarry,Limestone,Chakwal,Fauji Cement Ltd,2,32.9120,72.7165
DEMO-CKW-01,Chakwal Limestone Quarry,Limestone,Chakwal,Fauji Cement Ltd,3,32.9110,72.7290
DEMO-CKW-01,Chakwal Limestone Quarry,Limestone,Chakwal,Fauji Cement Ltd,4,32.9015,72.7275
DEMO-CKW-01,Chakwal Limestone Quarry,Limestone,Chakwal,Fauji Cement Ltd,5,32.9025,72.7150
DEMO-DDT-02,Dandot Salt Range Gypsum,Gypsum,Jhelum,Gharibwal Mining,1,32.6450,72.9600
DEMO-DDT-02,Dandot Salt Range Gypsum,Gypsum,Jhelum,Gharibwal Mining,2,32.6530,72.9620
DEMO-DDT-02,Dandot Salt Range Gypsum,Gypsum,Jhelum,Gharibwal Mining,3,32.6515,72.9730
DEMO-DDT-02,Dandot Salt Range Gypsum,Gypsum,Jhelum,Gharibwal Mining,4,32.6435,72.9710
DEMO-DDT-02,Dandot Salt Range Gypsum,Gypsum,Jhelum,Gharibwal Mining,5,32.6450,72.9600"""
    else:
        return """lease_id,quarry_name,mineral,district,company_name,lease_status,lease_area_ha,boundary_wkt
DEMO-KHB-03,Khushab Silica Works,Silica Sand,Khushab,Indus Minerals Ltd,ACTIVE,42.5,"POLYGON((72.3500 32.2900, 72.3580 32.2900, 72.3580 32.2960, 72.3500 32.2960, 72.3500 32.2900))"
DEMO-KHW-04,Khewra Salt Block,Rock Salt,Jhelum,PMDC Ltd,ACTIVE,38.2,"POLYGON((73.0100 32.6500, 73.0200 32.6500, 73.0200 32.6580, 73.0100 32.6580, 73.0100 32.6500))" """
