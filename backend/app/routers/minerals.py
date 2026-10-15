from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.db import get_db
from app.services.mineral_service import get_mineral_density, calculate_production_estimates

router = APIRouter(prefix="/api/minerals", tags=["Minerals"])

class ProductionCalculationRequest(BaseModel):
    mineral_name: str = "Limestone"
    excavation_area_sqm: float
    density_override: Optional[float] = None
    user_volume_m3: Optional[float] = None
    assumed_depth_m: Optional[float] = None
    waste_fraction: float = 0.15
    recovery_rate: float = 0.85

@router.get("")
def list_minerals():
    """List reference minerals with authoritative density and citation data."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM mineral_properties ORDER BY mineral_name ASC")
    rows = cursor.fetchall()
    conn.close()
    return {"minerals": [dict(r) for r in rows]}

@router.get("/{mineral_name}")
def get_mineral_info(mineral_name: str):
    """Retrieve density parameters for specific mineral."""
    return get_mineral_density(mineral_name)

@router.post("/estimate")
def estimate_production(req: ProductionCalculationRequest):
    """Calculates excavation mass and volume according to verified geotechnical equations."""
    min_info = get_mineral_density(req.mineral_name)
    density = req.density_override if req.density_override else min_info["in_situ_bulk_density"]

    return calculate_production_estimates(
        excavation_area_sqm=req.excavation_area_sqm,
        density_t_per_m3=density,
        user_volume_m3=req.user_volume_m3,
        assumed_depth_m=req.assumed_depth_m,
        waste_fraction=req.waste_fraction,
        recovery_rate=req.recovery_rate
    )
