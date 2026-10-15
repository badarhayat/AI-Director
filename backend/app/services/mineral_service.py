from typing import Dict, Any, Optional
from app.db import get_db

def get_mineral_density(mineral_name: str) -> Dict[str, Any]:
    """Retrieve density parameters for a mineral from database or standard geological tables."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT mineral_name, in_situ_bulk_density, loose_bulk_density, particle_density, unit, source_reference, source_url
    FROM mineral_properties
    WHERE LOWER(mineral_name) = LOWER(?)
    """, (mineral_name,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            "mineral_name": row["mineral_name"],
            "in_situ_bulk_density": row["in_situ_bulk_density"],
            "loose_bulk_density": row["loose_bulk_density"],
            "particle_density": row["particle_density"],
            "unit": row["unit"],
            "source_reference": row["source_reference"],
            "source_url": row["source_url"],
            "is_measured": False,
            "density_type": "In-situ Bulk Density"
        }

    # Default fallback (Limestone)
    return {
        "mineral_name": mineral_name,
        "in_situ_bulk_density": 2.60,
        "loose_bulk_density": 1.55,
        "particle_density": 2.71,
        "unit": "tonnes/m³",
        "source_reference": "SME Mining Engineering Handbook (Standard Limestone Reference)",
        "source_url": "https://mines.punjab.gov.pk",
        "is_measured": False,
        "density_type": "In-situ Bulk Density (Assumed)"
    }

def calculate_production_estimates(
    excavation_area_sqm: float,
    density_t_per_m3: float,
    user_volume_m3: Optional[float] = None,
    assumed_depth_m: Optional[float] = None,
    waste_fraction: float = 0.15,
    recovery_rate: float = 0.85
) -> Dict[str, Any]:
    """
    Computes mass and volume estimates based strictly on verified principles.
    Distinguishes reliably computed area from volume requiring DEM or site measurement.
    """
    if user_volume_m3 is not None and user_volume_m3 > 0:
        volume_m3 = round(user_volume_m3, 2)
        volume_status = "USER_ENTERED_SURVEY"
        volume_note = "Volume derived from site topographic survey / 3D DEM differencing."
    elif assumed_depth_m is not None and assumed_depth_m > 0:
        # Illustrative calculation based on user assumed bench depth
        volume_m3 = round(excavation_area_sqm * assumed_depth_m, 2)
        volume_status = "ILLUSTRATIVE_ASSUMED_DEPTH"
        volume_note = f"Illustrative calculation assuming average quarry bench cut depth of {assumed_depth_m}m. Requires DEM or LiDAR verification."
    else:
        volume_m3 = None
        volume_status = "DATA_LIMITATION"
        volume_note = "Excavation area estimated; excavation volume and production cannot be reliably quantified from 2D satellite imagery alone. Requires validated DEM, LiDAR, or drone photogrammetry."

    if volume_m3 is not None:
        excavated_mass_tonnes = round(volume_m3 * density_t_per_m3, 2)
        waste_tonnes = round(excavated_mass_tonnes * waste_fraction, 2)
        recoverable_tonnes = round((excavated_mass_tonnes - waste_tonnes) * recovery_rate, 2)
    else:
        excavated_mass_tonnes = None
        waste_tonnes = None
        recoverable_tonnes = None

    return {
        "excavation_area_sqm": round(excavation_area_sqm, 2),
        "excavation_area_ha": round(excavation_area_sqm / 10000.0, 4),
        "volume_m3": volume_m3,
        "volume_status": volume_status,
        "volume_note": volume_note,
        "in_situ_bulk_density_t_per_m3": density_t_per_m3,
        "excavated_mass_tonnes": excavated_mass_tonnes,
        "waste_fraction": waste_fraction,
        "estimated_waste_tonnes": waste_tonnes,
        "recovery_rate": recovery_rate,
        "estimated_saleable_production_tonnes": recoverable_tonnes,
        "disclaimer": "Production estimates are dependent on elevation models and density assumptions. Field survey validation required."
    }
