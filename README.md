# AI-MIMS: AI Mining Inspection and Monitoring System
### Directorate General of Mines & Minerals (DGM&M), Government of the Punjab, Pakistan
**Complete Working Demonstration Prototype**

---

## 1. Executive Summary & Regulatory Purpose

**AI-MIMS** (AI Mining Inspection and Monitoring System) is an operational, full-stack remote-sensing and GIS web platform engineered specifically for the **Directorate General of Mines & Minerals (DGM&M), Punjab, Pakistan**.

The application equips regulatory mining inspectors with automated satellite surveillance capabilities to detect quarry expansion, track concession compliance, measure unauthorized excavation outside legal boundaries, monitor environmental changes (vegetation cover loss and hydrological alteration), and estimate extracted mineral mass using verified geotechnical standards.

---

## 2. Core Primary Workflow

The primary regulatory workflow executes seamlessly without requiring manual boundary redrawing:

1. **Upload Lease CSV**: Bulk import mining concession coordinates in either **Format A (WKT / GeoJSON)** or **Format B (Multi-row Lat/Lon vertices)**.
2. **Select Lease**: Instant searchable selector on the Monitoring Console (e.g. *Chakwal Limestone Quarry*, *Dandot Salt Range Gypsum*).
3. **Automatic Zoom**: The Leaflet satellite map automatically pans and zooms to fit the concession boundary and its mandatory surveillance zone.
4. **Mandatory 1 KM Buffer**: The system automatically computes and displays the **1,000-metre surrounding monitoring zone** in projected metric coordinates (**EPSG:32643 / UTM Zone 43N**).
5. **Select Start and End Dates**: Define the baseline ($T_1$) and recent ($T_2$) observation window.
6. **Click "ANALYZE LEASE"**: Executes the automated multispectral change detection pipeline.
7. **View Colour-Coded Findings**:
   - **Official Lease Boundary**: Solid Blue
   - **1 KM Monitoring Zone**: Dashed Cyan / Turquoise
   - **Authorized Inside-Lease Disturbance**: Solid Red
   - **Potential Outside Boundary Encroachment**: Bright Red with High-Contrast Border & Flashing Alert
   - **Stockpiles & Dumps**: Orange
   - **Vegetation Cover Loss (NDVI drop)**: Magenta / Dark Pink
   - **Haul Roads**: Yellow
8. **Export & Download**:
   - One-click **Download Official PDF Inspection Report** (government-grade formatting with embedded satellite imagery, metrics tables, and formal inspector sign-off blocks).
   - **Export Google Earth KML** with styled polygons.
   - **Open in Google Earth Web** centered on exact quarry coordinates.

---

## 3. Technology Stack & Resource Principles

Built strictly in accordance with open-source, local-first, zero-mandatory-paid-API principles:

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Leaflet GIS.
- **Backend**: Python 3.11, FastAPI, Pydantic, GeoPandas, Shapely 2.1, PyProj 3.7, Rasterio, NumPy, OpenCV, Pillow.
- **Reports**: ReportLab 4.4 (generates formal vector-styled PDF inspection reports).
- **Database**: SQLite (clean, normalized schema easily migratable to PostgreSQL/PostGIS).
- **Geodesy & Coordinate Reference Systems**:
  - **Storage & Web Display**: `EPSG:4326` (WGS 84 Geographic Latitude/Longitude).
  - **Metric Buffer & Area Calculations**: `EPSG:32643` (WGS 84 / UTM Zone 43N, standard projection for Punjab / Potohar / Salt Range).
  - *Guarantees that geographic degrees are never erroneously treated as metres.*

---

## 4. Key Modules & Analytical Capabilities

### A. Bulk Lease CSV Import
- Supports two CSV formats:
  - **Format A**: One row per lease with `boundary_wkt` or `boundary_geojson`.
  - **Format B**: Multiple rows per lease with `vertex_order`, `latitude`, `longitude`.
- Automatic polygon validation, closure verification, self-intersection repair, and duplicate detection.
- Compares calculated UTM 43N surface area with stated concession hectares and flags discrepancies $> 15\%$.
- Downloadable sample CSV templates built directly into the interface.

### B. Mandatory 1 KM Surrounding-Area Monitoring
- Outer 1,000-metre buffer generated in projected UTM 43N coordinates:
  $$\text{Surrounding Zone} = \text{Buffer}(\text{Lease Polygon}, 1000\text{ m}) \setminus \text{Lease Polygon}$$
- Detects excavation encroaching into neighboring lands or forest areas.
- Uses the regulatory alert: **`POTENTIAL BOUNDARY ENCROACHMENT`**.

### C. Change Detection & Spectral Analysis
- Calculates Normalized Difference Vegetation Index:
  $$\text{NDVI} = \frac{\text{NIR} - \text{Red}}{\text{NIR} + \text{Red}}$$
- Calculates Normalized Difference Water Index (NDWI) for drainage impact.
- Identifies bare ground and quarry pit deepening via multispectral surface reflectance differencing.
- Filters single-pixel sensor noise with OpenCV morphological opening and closing filters.
- Formula for disturbance percentage:
  $$\text{Change Percentage} = \frac{\text{Detected New Disturbance Area (ha)}}{\text{Official Lease Area (ha)}} \times 100$$

### D. Geotechnical Mineral Density & Production Estimation
- Comprehensive mineral lookup including **Limestone (2.60 t/m³)**, **Gypsum (2.31 t/m³)**, **Rock Salt (2.16 t/m³)**, **Silica Sand (2.65 t/m³)**, **Coal (1.35 t/m³)**, and **Clay/Shale (2.20 t/m³)**.
- Citations from the *SME Mining Engineering Handbook* and *Geological Survey of Pakistan*.
- Distinguishes between:
  - *In-situ Bulk Density* (undisturbed bedrock)
  - *Loose Bulk Density* (blasted/fragmented rock)
  - *Particle Density* (solid grain density)
- **Scientific Honesty & Data Limitations**:
  - Prominently warns inspectors that 2D satellite imagery alone cannot measure excavation depth.
  - Requires 3D Digital Elevation Models (DEMs), LiDAR, or drone photogrammetry for volumetric auditing.
  - Permits optional entered survey depth or volume to compute mass ($V \times \rho$).

---

## 5. Quickstart & Launch Instructions

### Prerequisites
- Python 3.10+ (with `pip`)
- Node.js v18+ (with `npm`)

### Launching the Application

1. **Start the Unified Server**:
   ```powershell
   cd C:\Users\Admin\.gemini\antigravity\scratch\ai-mims-punjab\backend
   python run.py
   ```
2. **Access the Web Application**:
   Open your browser to:
   [http://127.0.0.1:8000](http://127.0.0.1:8000)

*(The backend automatically hosts both the REST API and the compiled React production frontend on port 8000).*

### Running in Frontend Development Mode (Optional)
If modifying React source code with Hot Module Replacement (HMR):
```powershell
cd C:\Users\Admin\.gemini\antigravity\scratch\ai-mims-punjab\frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

---

## 6. Pre-Packaged Punjab Demonstration Data

The prototype comes seeded with realistic limestone, gypsum, silica sand, and salt concessions in Punjab:
- **`DEMO-CKW-01`**: Chakwal Limestone Quarry (*Fauji Cement Ltd, Chakwal*) — 124.8 ha.
- **`DEMO-DDT-02`**: Dandot Salt Range Gypsum (*Gharibwal Mining, Jhelum*) — 94.7 ha.
- **`DEMO-KHB-03`**: Khushab Silica Works (*Indus Minerals Ltd, Khushab*) — 50.2 ha.
- **`DEMO-KHW-04`**: Khewra Salt Block (*PMDC Ltd, Jhelum*) — 83.2 ha.

---

## 7. Demonstration Script for Regulators

Follow this 3-minute sequence to demonstrate the platform to DGM&M leadership:

1. **Dashboard**: Show the provincial overview of active concessions, aggregate disturbance, and encroachment alerts.
2. **Lease Selection**: Navigate to **Satellite Monitoring**, select `DEMO-CKW-01 (Chakwal Limestone Quarry)`. Notice the map instantly flies to the Salt Range hills, highlights the blue lease boundary, and draws the cyan 1 km buffer.
3. **Execution**: Click **ANALYZE LEASE**. Point out the multi-stage progress indicator executing geometry verification, Sentinel-2 overpass acquisition, NDVI calculation, and boundary intersection.
4. **Encroachment Finding**: Point to the **`POTENTIAL BOUNDARY ENCROACHMENT`** alert card and the bright red disturbance polygon located ~120m outside the northern perimeter. Explain how the mandatory 1 km buffer caught illegal extraction that standard inside-only monitoring would miss.
5. **PDF Dossier**: Click **Download PDF Report**. Show the formal government report generated with official crest, metric tables, satellite before/after maps, and inspector sign-off block.
6. **CSV Import**: Navigate to **Lease Import (CSV)**, download the sample template, upload `sample_leases_format_b.csv`, and demonstrate instant polygon validation and UTM 43N projected area computation.
