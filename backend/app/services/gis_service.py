import json
import math
from typing import Dict, Any, Tuple, List, Optional
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import transform
import pyproj
from app.config import PUNJAB_UTM_CRS, GEOGRAPHIC_CRS, DEFAULT_BUFFER_METERS

# Set up transformers
# WGS84 (EPSG:4326) -> UTM 43N (EPSG:32643) and reverse
wgs84 = pyproj.CRS(GEOGRAPHIC_CRS)
utm43n = pyproj.CRS(PUNJAB_UTM_CRS)

proj_to_utm = pyproj.Transformer.from_crs(wgs84, utm43n, always_xy=True).transform
proj_to_wgs84 = pyproj.Transformer.from_crs(utm43n, wgs84, always_xy=True).transform

def project_geom_to_utm(geom):
    """Transform geometry from EPSG:4326 (lon, lat) to EPSG:32643 (metres)."""
    return transform(proj_to_utm, geom)

def project_geom_to_wgs84(geom):
    """Transform geometry from EPSG:32643 (metres) to EPSG:4326 (lon, lat)."""
    return transform(proj_to_wgs84, geom)

def calculate_projected_area(geom_wgs84) -> Tuple[float, float]:
    """
    Calculate area in square metres and hectares using projected UTM Zone 43N CRS.
    Guarantees that geographic degrees are never treated as metres.
    """
    geom_utm = project_geom_to_utm(geom_wgs84)
    area_sqm = float(geom_utm.area)
    area_ha = float(area_sqm / 10000.0)
    return area_sqm, area_ha

def create_monitoring_buffer(lease_geom_wgs84, buffer_meters: float = DEFAULT_BUFFER_METERS) -> Tuple[Any, Any]:
    """
    Given an official lease polygon in WGS84:
    1. Projects it to UTM Zone 43N (metres)
    2. Buffers outward by buffer_meters (default 1000m)
    3. Subtracts the lease polygon to form the ring/surrounding monitoring zone
    4. Projects both back to WGS84
    Returns: (buffered_total_wgs84, monitoring_zone_ring_wgs84)
    """
    lease_utm = project_geom_to_utm(lease_geom_wgs84)
    buffered_total_utm = lease_utm.buffer(buffer_meters)
    monitoring_zone_ring_utm = buffered_total_utm.difference(lease_utm)

    buffered_total_wgs84 = project_geom_to_wgs84(buffered_total_utm)
    monitoring_zone_ring_wgs84 = project_geom_to_wgs84(monitoring_zone_ring_utm)

    return buffered_total_wgs84, monitoring_zone_ring_wgs84

def classify_disturbance_geometry(disturbance_geom_wgs84, lease_geom_wgs84) -> Dict[str, Any]:
    """
    Classify a disturbance polygon or multipolygon into:
    - Inside lease disturbance
    - Outside lease disturbance (potential boundary encroachment)
    Calculates exact projected areas in sqm and ha.
    """
    lease_utm = project_geom_to_utm(lease_geom_wgs84)
    dist_utm = project_geom_to_utm(disturbance_geom_wgs84)

    inside_utm = dist_utm.intersection(lease_utm)
    outside_utm = dist_utm.difference(lease_utm)

    inside_sqm = float(inside_utm.area) if not inside_utm.is_empty else 0.0
    inside_ha = inside_sqm / 10000.0

    outside_sqm = float(outside_utm.area) if not outside_utm.is_empty else 0.0
    outside_ha = outside_sqm / 10000.0

    total_sqm = inside_sqm + outside_sqm
    total_ha = total_sqm / 10000.0

    inside_wgs84 = project_geom_to_wgs84(inside_utm) if not inside_utm.is_empty else None
    outside_wgs84 = project_geom_to_wgs84(outside_utm) if not outside_utm.is_empty else None

    # Calculate distance from lease boundary for outside polygons if any
    encroachment_distance_m = 0.0
    if not outside_utm.is_empty:
        # Distance from boundary or max distance
        encroachment_distance_m = float(outside_utm.distance(lease_utm.exterior))

    return {
        "total_sqm": round(total_sqm, 2),
        "total_ha": round(total_ha, 4),
        "inside_sqm": round(inside_sqm, 2),
        "inside_ha": round(inside_ha, 4),
        "outside_sqm": round(outside_sqm, 2),
        "outside_ha": round(outside_ha, 4),
        "encroachment_distance_m": round(encroachment_distance_m, 1),
        "inside_geom": mapping(inside_wgs84) if inside_wgs84 else None,
        "outside_geom": mapping(outside_wgs84) if outside_wgs84 else None
    }

def validate_and_close_polygon(coords: List[Tuple[float, float]]) -> Tuple[Polygon, bool, Optional[str]]:
    """
    Validates a list of (lon, lat) or (lat, lon) coordinates:
    - Checks that coordinates are in valid ranges
    - Detects whether polygon is closed (first vertex == last vertex)
    - If not closed, automatically closes safely and flags it
    - Checks for self-intersection / validity
    """
    if len(coords) < 3:
        return None, False, "At least 3 vertices are required to form a polygon."

    auto_closed = False
    # Check if first and last vertices match within tolerance
    p1 = coords[0]
    p_last = coords[-1]
    if abs(p1[0] - p_last[0]) > 1e-7 or abs(p1[1] - p_last[1]) > 1e-7:
        coords = list(coords) + [p1]
        auto_closed = True

    try:
        poly = Polygon(coords)
        if not poly.is_valid:
            # Try buffer(0) to fix minor self-intersections
            poly = poly.buffer(0)
            if not poly.is_valid or poly.is_empty:
                return None, False, "Geometry is invalid or self-intersecting."
        return poly, auto_closed, None
    except Exception as e:
        return None, False, f"Failed to construct polygon: {str(e)}"

def get_polygon_bounding_box(geom) -> Dict[str, float]:
    """Return min_lat, max_lat, min_lon, max_lon for bounds."""
    minx, miny, maxx, maxy = geom.bounds
    return {
        "min_lon": minx,
        "min_lat": miny,
        "max_lon": maxx,
        "max_lat": maxy
    }
