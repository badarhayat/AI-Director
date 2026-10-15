import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager
from app.config import APP_TITLE, APP_SUBTITLE, BASE_DIR, FRONTEND_DIST_DIR
from app.db import init_db, get_db
from app.services.csv_importer import generate_csv_template, parse_lease_csv
from app.routers import leases, analysis, minerals, reports

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    init_db()

    # Seed demo leases if table is empty
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM leases")
    count = cursor.fetchone()[0]
    conn.close()

    if count == 0:
        print("Seeding initial Punjab demonstration leases...")
        demo_csv = generate_csv_template("FORMAT_B")
        parse_lease_csv(demo_csv, commit_to_db=True)
        demo_csv_a = generate_csv_template("FORMAT_A")
        parse_lease_csv(demo_csv_a, commit_to_db=True)

    yield

app = FastAPI(
    title=APP_TITLE,
    description=APP_SUBTITLE,
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration (configurable for production, default wildcard for local demo)
cors_origins_env = os.getenv("CORS_ORIGINS", "*").strip()
if cors_origins_env and cors_origins_env != "*":
    origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register routers
app.include_router(leases.router)
app.include_router(analysis.router)
app.include_router(minerals.router)
app.include_router(reports.router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "system": "AI-MIMS Punjab",
        "regulator": "Directorate General of Mines & Minerals, Government of the Punjab",
        "mode": "DEMONSTRATION PROTOTYPE"
    }

@app.get("/api/stats")
def get_dashboard_stats():
    """Calculates live metrics for the main regulatory dashboard."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM leases")
    total_leases = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT lease_id) FROM analyses")
    leases_analysed = cursor.fetchone()[0]

    cursor.execute("""
    SELECT 
        COALESCE(SUM(total_disturbance_ha), 0) as total_dist,
        COALESCE(SUM(outside_disturbance_ha), 0) as outside_dist,
        COALESCE(SUM(ndvi_loss_ha), 0) as veg_loss,
        COALESCE(SUM(stockpile_change_ha), 0) as stockpile_change,
        COUNT(CASE WHEN outside_disturbance_ha > 0 THEN 1 END) as encroachment_alerts,
        COUNT(CASE WHEN review_status = 'PENDING_REVIEW' THEN 1 END) as pending_reviews
    FROM analyses
    """)
    row = cursor.fetchone()
    conn.close()

    return {
        "registered_leases": total_leases,
        "leases_analysed": leases_analysed,
        "total_detected_disturbance_ha": round(row["total_dist"], 3),
        "total_outside_excavation_ha": round(row["outside_dist"], 3),
        "vegetation_cover_loss_ha": round(row["veg_loss"], 3),
        "stockpile_changes_ha": round(row["stockpile_change"], 3),
        "encroachment_alerts_count": row["encroachment_alerts"],
        "pending_field_verifications": row["pending_reviews"],
        "is_demo_data": True
    }

# Mount static frontend production build if available
if FRONTEND_DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST_DIR), html=True), name="frontend")

# SPA client-side routing fallback and API 404 separation
@app.exception_handler(StarletteHTTPException)
async def spa_or_api_exception_handler(request: Request, exc: StarletteHTTPException):
    # API endpoints always return clean JSON error responses
    if request.url.path.startswith("/api"):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail or "Not Found"})
    # Non-API 404s serve index.html for React client-side routing
    if exc.status_code == 404 and FRONTEND_DIST_DIR.exists():
        index_file = FRONTEND_DIST_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
