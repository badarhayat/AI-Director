import sqlite3
import json
from datetime import datetime
from app.config import DB_PATH

_initialized = False

def get_db():
    global _initialized
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    if not _initialized:
        _check_and_init_db(conn)
        _initialized = True
    return conn

def _check_and_init_db(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='leases'")
    if not cursor.fetchone():
        init_db()
    else:
        # Check and migrate columns in detected_polygons
        cursor.execute("PRAGMA table_info(detected_polygons)")
        columns = [row[1] for row in cursor.fetchall()]
        if "verification_status" not in columns:
            cursor.execute("ALTER TABLE detected_polygons ADD COLUMN verification_status TEXT DEFAULT 'CANDIDATE'")
        if "inspector_notes" not in columns:
            cursor.execute("ALTER TABLE detected_polygons ADD COLUMN inspector_notes TEXT DEFAULT ''")
        if "verified_at" not in columns:
            cursor.execute("ALTER TABLE detected_polygons ADD COLUMN verified_at TEXT")

        # Check imported_layers table
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='imported_layers'")
        if not cursor.fetchone():
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS imported_layers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lease_id TEXT,
                layer_name TEXT NOT NULL,
                layer_type TEXT NOT NULL,
                acquisition_date TEXT,
                source_description TEXT,
                file_path TEXT,
                geojson_data TEXT,
                bounds_json TEXT,
                created_at TEXT NOT NULL
            );
            """)
        conn.commit()


def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS leases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lease_id TEXT UNIQUE NOT NULL,
        quarry_name TEXT NOT NULL,
        mineral TEXT NOT NULL,
        district TEXT NOT NULL,
        company_name TEXT,
        lease_status TEXT DEFAULT 'ACTIVE',
        lease_area_ha REAL,
        calculated_area_ha REAL,
        boundary_geojson TEXT NOT NULL,
        monitoring_zone_geojson TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boundary_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lease_id TEXT NOT NULL,
        version_num INTEGER NOT NULL,
        boundary_geojson TEXT NOT NULL,
        change_reason TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (lease_id) REFERENCES leases (lease_id)
    );

    CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        actual_start_date TEXT NOT NULL,
        actual_end_date TEXT NOT NULL,
        imagery_source TEXT NOT NULL,
        resolution_m REAL DEFAULT 10.0,
        total_disturbance_ha REAL NOT NULL,
        total_disturbance_sqm REAL NOT NULL,
        inside_disturbance_ha REAL NOT NULL,
        inside_disturbance_sqm REAL NOT NULL,
        outside_disturbance_ha REAL NOT NULL,
        outside_disturbance_sqm REAL NOT NULL,
        encroachment_pct REAL NOT NULL,
        change_pct_of_lease REAL NOT NULL,
        new_benches_status TEXT,
        stockpile_change_ha REAL DEFAULT 0.0,
        haul_roads_km REAL DEFAULT 0.0,
        ndvi_loss_ha REAL DEFAULT 0.0,
        water_change_ha REAL DEFAULT 0.0,
        volume_m3 REAL,
        density_t_per_m3 REAL,
        mass_tonnes REAL,
        production_notes TEXT,
        is_demo INTEGER DEFAULT 1,
        review_status TEXT DEFAULT 'PENDING_REVIEW',
        reviewer_remarks TEXT,
        report_pdf_path TEXT,
        map_image_path TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (lease_id) REFERENCES leases (lease_id)
    );

    CREATE TABLE IF NOT EXISTS detected_polygons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        analysis_id TEXT NOT NULL,
        category TEXT NOT NULL,
        feature_type TEXT NOT NULL,
        area_sqm REAL NOT NULL,
        area_ha REAL NOT NULL,
        geojson_geometry TEXT NOT NULL,
        is_outside_lease INTEGER DEFAULT 0,
        confidence REAL DEFAULT 0.85,
        verification_status TEXT DEFAULT 'CANDIDATE',
        inspector_notes TEXT DEFAULT '',
        verified_at TEXT,
        FOREIGN KEY (analysis_id) REFERENCES analyses (id)
    );

    CREATE TABLE IF NOT EXISTS imported_layers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lease_id TEXT,
        layer_name TEXT NOT NULL,
        layer_type TEXT NOT NULL,
        acquisition_date TEXT,
        source_description TEXT,
        file_path TEXT,
        geojson_data TEXT,
        bounds_json TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mineral_properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mineral_name TEXT UNIQUE NOT NULL,
        in_situ_bulk_density REAL NOT NULL,
        loose_bulk_density REAL NOT NULL,
        particle_density REAL NOT NULL,
        unit TEXT DEFAULT 'tonnes/m³',
        source_reference TEXT,
        source_url TEXT
    );
    """)

    # Seed standard mineral properties if not present
    cursor.execute("SELECT COUNT(*) FROM mineral_properties")
    if cursor.fetchone()[0] == 0:
        minerals = [
            ("Limestone", 2.60, 1.55, 2.71, "tonnes/m³", "SME Mining Engineering Handbook (3rd Ed.) & USGS Rock Density Data", "https://pubs.usgs.gov/bul/1582/report.pdf"),
            ("Gypsum", 2.31, 1.35, 2.32, "tonnes/m³", "Engineering Geology Rock Property Tables, Salt Range Formations", "https://mines.punjab.gov.pk"),
            ("Rock Salt", 2.16, 1.28, 2.17, "tonnes/m³", "Khewra Salt Range Geological Survey of Pakistan", "https://www.gsp.gov.pk"),
            ("Silica Sand", 2.65, 1.60, 2.65, "tonnes/m³", "Potohar Basin Industrial Mineral Reference Sheets", "https://mines.punjab.gov.pk"),
            ("Coal (Sub-bituminous)", 1.35, 0.85, 1.40, "tonnes/m³", "Punjab Mineral Development Corporation (PUNJMIN)", "https://punjmin.punjab.gov.pk"),
            ("Clay / Shale", 2.20, 1.45, 2.40, "tonnes/m³", "Building Research Station Raw Material Standards", "https://mines.punjab.gov.pk")
        ]
        cursor.executemany("""
        INSERT INTO mineral_properties (mineral_name, in_situ_bulk_density, loose_bulk_density, particle_density, unit, source_reference, source_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, minerals)

    conn.commit()
    conn.close()
