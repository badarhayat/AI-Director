import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
# Support custom persistent storage location (e.g. Render persistent disk /var/data or /data)
DATA_DIR_ENV = os.getenv("DATA_DIR") or os.getenv("MIMS_DATA_DIR")
if DATA_DIR_ENV:
    DATA_DIR = Path(DATA_DIR_ENV).resolve()
else:
    DATA_DIR = BASE_DIR / "data"

REPORTS_DIR = DATA_DIR / "reports"
SAMPLE_IMAGERY_DIR = DATA_DIR / "sample_imagery"
UPLOADS_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "mims.db"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_IMAGERY_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Optional frontend dist path override
FRONTEND_DIST_ENV = os.getenv("FRONTEND_DIST")
if FRONTEND_DIST_ENV:
    FRONTEND_DIST_DIR = Path(FRONTEND_DIST_ENV).resolve()
else:
    FRONTEND_DIST_DIR = BASE_DIR.parent.parent / "frontend" / "dist"

# Geospatial parameters for Punjab, Pakistan
DEFAULT_BUFFER_METERS = 1000  # Mandatory 1 km outer monitoring zone
GEOGRAPHIC_CRS = "EPSG:4326"  # WGS84 (lat/lon)
PUNJAB_UTM_CRS = "EPSG:32643"  # UTM Zone 43N (WGS84 UTM zone covering Punjab / Potohar / Salt Range)

APP_TITLE = "AI-MIMS: AI Mining Inspection and Monitoring System"
APP_SUBTITLE = "Directorate General of Mines & Minerals, Government of the Punjab"
