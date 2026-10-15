import xml.etree.ElementTree as ET
from typing import Dict, Any, List
from shapely.geometry import shape

def coords_to_kml_string(coordinates: List[List[float]]) -> str:
    """Converts [[lon, lat], ...] to KML 'lon,lat,0 lon,lat,0' string."""
    return " ".join([f"{c[0]},{c[1]},0" for c in coordinates])

def generate_kml_for_analysis(
    lease_data: Dict[str, Any],
    analysis_data: Dict[str, Any],
    monitoring_zone_geojson: Dict[str, Any],
    features_geojson: Dict[str, Any]
) -> str:
    """
    Generates standard OGC KML 2.2 XML document containing:
    - Official Lease Boundary (Blue line, semi-transparent fill)
    - 1 km Monitoring Zone (Cyan line, light fill)
    - Inside Disturbance Polygons (Red)
    - Potential Outside Encroachment Polygons (Bright Red)
    """
    kml = ET.Element("kml", xmlns="http://www.opengis.net/kml/2.2")
    doc = ET.SubElement(kml, "Document")

    name = ET.SubElement(doc, "name")
    name.text = f"AI-MIMS Inspection - {lease_data.get('quarry_name', 'Quarry')} ({lease_data.get('lease_id')})"

    desc = ET.SubElement(doc, "description")
    desc.text = f"Directorate General of Mines & Minerals Punjab | Satellite Monitoring Analysis for {lease_data.get('lease_id')}"

    # Style 1: Lease Boundary (Blue)
    style_lease = ET.SubElement(doc, "Style", id="leaseStyle")
    lstyle = ET.SubElement(style_lease, "LineStyle")
    ET.SubElement(lstyle, "color").text = "ffff0000"  # aabbggrr -> Blue
    ET.SubElement(lstyle, "width").text = "3"
    pstyle = ET.SubElement(style_lease, "PolyStyle")
    ET.SubElement(pstyle, "color").text = "33ff0000"

    # Style 2: 1 km Buffer (Cyan)
    style_buffer = ET.SubElement(doc, "Style", id="bufferStyle")
    lstyle_buf = ET.SubElement(style_buffer, "LineStyle")
    ET.SubElement(lstyle_buf, "color").text = "ffffff00"  # Cyan
    ET.SubElement(lstyle_buf, "width").text = "2"
    pstyle_buf = ET.SubElement(style_buffer, "PolyStyle")
    ET.SubElement(pstyle_buf, "color").text = "22ffff00"

    # Style 3: Inside Disturbance (Red)
    style_inside = ET.SubElement(doc, "Style", id="insideDisturbance")
    lstyle_in = ET.SubElement(style_inside, "LineStyle")
    ET.SubElement(lstyle_in, "color").text = "ff0000ff"
    ET.SubElement(lstyle_in, "width").text = "2"
    pstyle_in = ET.SubElement(style_inside, "PolyStyle")
    ET.SubElement(pstyle_in, "color").text = "7f0000ff"

    # Style 4: Outside Encroachment (Bright Red Alert)
    style_out = ET.SubElement(doc, "Style", id="encroachmentAlert")
    lstyle_out = ET.SubElement(style_out, "LineStyle")
    ET.SubElement(lstyle_out, "color").text = "ff0000ff"
    ET.SubElement(lstyle_out, "width").text = "4"
    pstyle_out = ET.SubElement(style_out, "PolyStyle")
    ET.SubElement(pstyle_out, "color").text = "b30000ff"

    # Style 5: Confirmed Violation
    style_conf = ET.SubElement(doc, "Style", id="confirmedViolation")
    lstyle_c = ET.SubElement(style_conf, "LineStyle")
    ET.SubElement(lstyle_c, "color").text = "ff0000ff"
    ET.SubElement(lstyle_c, "width").text = "4"
    pstyle_c = ET.SubElement(style_conf, "PolyStyle")
    ET.SubElement(pstyle_c, "color").text = "cc0000ff"

    # Style 6: Requires Field Verification (Amber)
    style_fv = ET.SubElement(doc, "Style", id="fieldVerify")
    lstyle_fv = ET.SubElement(style_fv, "LineStyle")
    ET.SubElement(lstyle_fv, "color").text = "ff0080ff"
    ET.SubElement(lstyle_fv, "width").text = "3"
    pstyle_fv = ET.SubElement(style_fv, "PolyStyle")
    ET.SubElement(pstyle_fv, "color").text = "880080ff"

    # Style 7: Rejected False Positive (Gray)
    style_rej = ET.SubElement(doc, "Style", id="rejectedDetection")
    lstyle_rej = ET.SubElement(style_rej, "LineStyle")
    ET.SubElement(lstyle_rej, "color").text = "ff808080"
    ET.SubElement(lstyle_rej, "width").text = "2"
    pstyle_rej = ET.SubElement(style_rej, "PolyStyle")
    ET.SubElement(pstyle_rej, "color").text = "44808080"

    # Style 8: Candidate Benches (Purple)
    style_bench = ET.SubElement(doc, "Style", id="candidateBench")
    lstyle_b = ET.SubElement(style_bench, "LineStyle")
    ET.SubElement(lstyle_b, "color").text = "ffed3a7c"
    ET.SubElement(lstyle_b, "width").text = "2"
    pstyle_b = ET.SubElement(style_bench, "PolyStyle")
    ET.SubElement(pstyle_b, "color").text = "7fed3a7c"

    # Style 9: Stockpiles (Orange)
    style_sp = ET.SubElement(doc, "Style", id="stockpileStyle")
    lstyle_sp = ET.SubElement(style_sp, "LineStyle")
    ET.SubElement(lstyle_sp, "color").text = "ff1673f9"
    ET.SubElement(lstyle_sp, "width").text = "2"
    pstyle_sp = ET.SubElement(style_sp, "PolyStyle")
    ET.SubElement(pstyle_sp, "color").text = "881673f9"

    # Style 10: Haul Roads (Yellow)
    style_hr = ET.SubElement(doc, "Style", id="haulRoadStyle")
    lstyle_hr = ET.SubElement(style_hr, "LineStyle")
    ET.SubElement(lstyle_hr, "color").text = "ff08b3ea"
    ET.SubElement(lstyle_hr, "width").text = "3"
    pstyle_hr = ET.SubElement(style_hr, "PolyStyle")
    ET.SubElement(pstyle_hr, "color").text = "8808b3ea"

    # Placemark: Official Lease Boundary
    lease_geom = lease_data.get("boundary_geojson")
    if lease_geom and "coordinates" in lease_geom:
        pm_lease = ET.SubElement(doc, "Placemark")
        ET.SubElement(pm_lease, "name").text = f"Official Lease: {lease_data.get('lease_id')}"
        ET.SubElement(pm_lease, "description").text = f"Official Concession Boundary\nMineral: {lease_data.get('mineral')}\nDistrict: {lease_data.get('district')}\nArea: {lease_data.get('lease_area_ha')} ha"
        ET.SubElement(pm_lease, "styleUrl").text = "#leaseStyle"
        poly_el = ET.SubElement(pm_lease, "Polygon")
        outer = ET.SubElement(poly_el, "outerBoundaryIs")
        ring = ET.SubElement(outer, "LinearRing")
        ET.SubElement(ring, "coordinates").text = coords_to_kml_string(lease_geom["coordinates"][0])

    # Placemark: 1 km Buffer
    if monitoring_zone_geojson and "coordinates" in monitoring_zone_geojson:
        pm_buf = ET.SubElement(doc, "Placemark")
        ET.SubElement(pm_buf, "name").text = "1 KM Surrounding Monitoring Zone"
        ET.SubElement(pm_buf, "description").text = "Mandatory outer 1,000m surveillance buffer beyond official lease boundary"
        ET.SubElement(pm_buf, "styleUrl").text = "#bufferStyle"
        poly_buf = ET.SubElement(pm_buf, "Polygon")
        outer_b = ET.SubElement(poly_buf, "outerBoundaryIs")
        ring_b = ET.SubElement(outer_b, "LinearRing")
        ET.SubElement(ring_b, "coordinates").text = coords_to_kml_string(monitoring_zone_geojson["coordinates"][0])

    # Placemarks: Detected Features
    inside_features = features_geojson.get("inside", [])
    for idx, f in enumerate(inside_features, start=1):
        geom = f.get("geometry")
        if geom and "coordinates" in geom:
            v_status = f.get("properties", {}).get("verification_status", "CANDIDATE")
            style_target = "#insideDisturbance"
            if v_status == "CONFIRMED":
                style_target = "#confirmedViolation"
            elif v_status == "FIELD_VERIFY":
                style_target = "#fieldVerify"
            elif v_status == "REJECTED":
                style_target = "#rejectedDetection"

            pm = ET.SubElement(doc, "Placemark")
            ET.SubElement(pm, "name").text = f"Inside Excavation #{idx} [{v_status}] ({f['properties'].get('area_ha', 0):.2f} ha)"
            notes_str = f"\nInspector Notes: {f['properties'].get('inspector_notes')}" if f['properties'].get('inspector_notes') else ""
            ET.SubElement(pm, "description").text = f"Authorized quarry excavation within lease perimeter\nArea: {f['properties'].get('area_sqm', 0):,.1f} m²\nStatus: {v_status}{notes_str}"
            ET.SubElement(pm, "styleUrl").text = style_target
            poly_f = ET.SubElement(pm, "Polygon")
            outer_f = ET.SubElement(poly_f, "outerBoundaryIs")
            ring_f = ET.SubElement(outer_f, "LinearRing")
            coords = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]
            ET.SubElement(ring_f, "coordinates").text = coords_to_kml_string(coords)

    outside_features = features_geojson.get("outside", [])
    for idx, f in enumerate(outside_features, start=1):
        geom = f.get("geometry")
        if geom and "coordinates" in geom:
            v_status = f.get("properties", {}).get("verification_status", "CANDIDATE")
            style_target = "#encroachmentAlert"
            if v_status == "CONFIRMED":
                style_target = "#confirmedViolation"
            elif v_status == "FIELD_VERIFY":
                style_target = "#fieldVerify"
            elif v_status == "REJECTED":
                style_target = "#rejectedDetection"

            pm = ET.SubElement(doc, "Placemark")
            ET.SubElement(pm, "name").text = f"⚠️ POTENTIAL BOUNDARY ENCROACHMENT #{idx} [{v_status}] ({f['properties'].get('area_ha', 0):.2f} ha)"
            notes_str = f"\nInspector Notes: {f['properties'].get('inspector_notes')}" if f['properties'].get('inspector_notes') else ""
            ET.SubElement(pm, "description").text = f"CRITICAL ALERT: Excavation detected outside official lease boundary!\nDistance from boundary: ~{f['properties'].get('distance_m', 0)} m\nArea: {f['properties'].get('area_sqm', 0):,.1f} m²\nStatus: {v_status}{notes_str}\nRequires immediate field inspection."
            ET.SubElement(pm, "styleUrl").text = style_target
            poly_f = ET.SubElement(pm, "Polygon")
            outer_f = ET.SubElement(poly_f, "outerBoundaryIs")
            ring_f = ET.SubElement(outer_f, "LinearRing")
            coords = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]
            ET.SubElement(ring_f, "coordinates").text = coords_to_kml_string(coords)

    # Additional Features: Benches, Stockpiles, Haul Roads
    benches = features_geojson.get("candidate_benches", [])
    for idx, f in enumerate(benches, start=1):
        geom = f.get("geometry")
        if geom and "coordinates" in geom:
            pm = ET.SubElement(doc, "Placemark")
            ET.SubElement(pm, "name").text = f"Candidate Bench Tier #{idx} ({f['properties'].get('area_ha', 0):.2f} ha)"
            ET.SubElement(pm, "description").text = f"Candidate bench formation from optical contour.\nArea: {f['properties'].get('area_sqm', 0):,.1f} m²\nNote: Requires sub-meter imagery or drone survey for bench width certification."
            ET.SubElement(pm, "styleUrl").text = "#candidateBench"
            poly_f = ET.SubElement(pm, "Polygon")
            outer_f = ET.SubElement(poly_f, "outerBoundaryIs")
            ring_f = ET.SubElement(outer_f, "LinearRing")
            coords = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]
            ET.SubElement(ring_f, "coordinates").text = coords_to_kml_string(coords)

    stockpiles = features_geojson.get("stockpiles", [])
    for idx, f in enumerate(stockpiles, start=1):
        geom = f.get("geometry")
        if geom and "coordinates" in geom:
            pm = ET.SubElement(doc, "Placemark")
            ET.SubElement(pm, "name").text = f"Mineral Stockpile #{idx} ({f['properties'].get('area_ha', 0):.2f} ha)"
            ET.SubElement(pm, "description").text = f"Candidate aggregate/spoil stockpile mound.\nArea: {f['properties'].get('area_sqm', 0):,.1f} m²"
            ET.SubElement(pm, "styleUrl").text = "#stockpileStyle"
            poly_f = ET.SubElement(pm, "Polygon")
            outer_f = ET.SubElement(poly_f, "outerBoundaryIs")
            ring_f = ET.SubElement(outer_f, "LinearRing")
            coords = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]
            ET.SubElement(ring_f, "coordinates").text = coords_to_kml_string(coords)

    haul_roads = features_geojson.get("haul_roads", [])
    for idx, f in enumerate(haul_roads, start=1):
        geom = f.get("geometry")
        if geom and "coordinates" in geom:
            pm = ET.SubElement(doc, "Placemark")
            ET.SubElement(pm, "name").text = f"Haul Road Corridor #{idx}"
            ET.SubElement(pm, "description").text = f"Active quarry haulage corridor connecting pit to access gate.\nArea: {f['properties'].get('area_sqm', 0):,.1f} m²"
            ET.SubElement(pm, "styleUrl").text = "#haulRoadStyle"
            poly_f = ET.SubElement(pm, "Polygon")
            outer_f = ET.SubElement(poly_f, "outerBoundaryIs")
            ring_f = ET.SubElement(outer_f, "LinearRing")
            coords = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]
            ET.SubElement(ring_f, "coordinates").text = coords_to_kml_string(coords)

    return ET.tostring(kml, encoding="utf-8", method="xml").decode("utf-8")

def get_google_earth_web_url(lat: float, lon: float, altitude_m: float = 3000.0) -> str:
    """Generates direct browser link to Google Earth Web centered on quarry coordinates."""
    return f"https://earth.google.com/web/@{lat:.6f},{lon:.6f},{altitude_m}a,0d,35y,0h,0t,0r"
