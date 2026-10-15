import urllib.request
import urllib.parse
import json
import os
from pathlib import Path

def test_date_driven_analysis():
    print("===================================================================")
    print("AI-MIMS DATE-DRIVEN SATELLITE ANALYSIS VERIFICATION SUITE")
    print("===================================================================")

    lease_id = "DEMO-CKW-01"

    # -------------------------------------------------------------
    # TEST 1: Date Validation (End Date < Start Date must be rejected)
    # -------------------------------------------------------------
    print("\n[TEST 1] Testing Date Validation (Inverted Date Window)...")
    invalid_payload = json.dumps({
        "lease_id": lease_id,
        "start_date": "2024-12-25",
        "end_date": "2024-01-15"
    }).encode('utf-8')
    req_inv = urllib.request.Request(
        'http://127.0.0.1:8000/api/analysis/run',
        data=invalid_payload,
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req_inv) as resp:
            print("ERROR: Inverted date window was unexpectedly accepted!")
            return False
    except urllib.error.HTTPError as e:
        err_msg = json.loads(e.read().decode())
        print(f"[OK] Correctly rejected with HTTP {e.code}: {err_msg.get('detail')}")
        assert e.code == 400

    # -------------------------------------------------------------
    # TEST 2: Case A — Zero-Change Period (Identical Observation Dates)
    # -------------------------------------------------------------
    print("\n[TEST 2] Testing Case A: Zero-Change Period (2024-01-15 to 2024-01-15)...")
    payload_a = json.dumps({
        "lease_id": lease_id,
        "start_date": "2024-01-15",
        "end_date": "2024-01-15"
    }).encode('utf-8')
    req_a = urllib.request.Request(
        'http://127.0.0.1:8000/api/analysis/run',
        data=payload_a,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_a) as resp:
        res_a = json.loads(resp.read().decode())
        m_a = res_a["metrics"]
        sat_a = res_a["satellite_metadata"]
        print(f"[OK] Analysis ID: {res_a['analysis_id']}")
        print(f"     Satellite Overpasses: {sat_a['actual_start_date']} -> {sat_a['actual_end_date']}")
        print(f"     Data Source: {sat_a['imagery_source']}")
        print(f"     Total Disturbance: {m_a['total_disturbance_ha']} ha")
        print(f"     Inside Disturbance: {m_a['inside_disturbance_ha']} ha")
        print(f"     Outside Encroachment: {m_a['outside_disturbance_ha']} ha")
        print(f"     Encroachment Alert: {m_a['encroachment_alert']}")
        assert m_a["total_disturbance_ha"] == 0.0, "Identical dates must yield 0 disturbance!"
        assert m_a["outside_disturbance_ha"] == 0.0, "Identical dates must yield 0 encroachment!"
        assert not m_a["encroachment_alert"], "No encroachment alert on zero-change period!"

    # -------------------------------------------------------------
    # TEST 3: Case B — Quarterly Observation Period (3 Months)
    # -------------------------------------------------------------
    print("\n[TEST 3] Testing Case B: Quarterly Observation Window (2024-01-15 to 2024-04-15)...")
    payload_b = json.dumps({
        "lease_id": lease_id,
        "start_date": "2024-01-15",
        "end_date": "2024-04-15"
    }).encode('utf-8')
    req_b = urllib.request.Request(
        'http://127.0.0.1:8000/api/analysis/run',
        data=payload_b,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_b) as resp:
        res_b = json.loads(resp.read().decode())
        m_b = res_b["metrics"]
        sat_b = res_b["satellite_metadata"]
        print(f"[OK] Analysis ID: {res_b['analysis_id']}")
        print(f"     Satellite Overpasses: {sat_b['actual_start_date']} -> {sat_b['actual_end_date']}")
        print(f"     Data Source: {sat_b['imagery_source']}")
        print(f"     Total Disturbance: {m_b['total_disturbance_ha']} ha")
        print(f"     Inside Disturbance: {m_b['inside_disturbance_ha']} ha")
        print(f"     Outside Encroachment: {m_b['outside_disturbance_ha']} ha")
        print(f"     Vegetation Loss: {m_b['vegetation_loss_ha']} ha")
        print(f"     Encroachment Alert: {m_b['encroachment_alert']}")
        assert m_b["total_disturbance_ha"] > 0, "Quarterly period must detect active pit deepening!"

    # -------------------------------------------------------------
    # TEST 4: Case C — Annual Observation Period (1 Year with Encroachment)
    # -------------------------------------------------------------
    print("\n[TEST 4] Testing Case C: Extended Annual Window (2024-01-15 to 2024-12-25)...")
    payload_c = json.dumps({
        "lease_id": lease_id,
        "start_date": "2024-01-15",
        "end_date": "2024-12-25"
    }).encode('utf-8')
    req_c = urllib.request.Request(
        'http://127.0.0.1:8000/api/analysis/run',
        data=payload_c,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_c) as resp:
        res_c = json.loads(resp.read().decode())
        m_c = res_c["metrics"]
        sat_c = res_c["satellite_metadata"]
        print(f"[OK] Analysis ID: {res_c['analysis_id']}")
        print(f"     Satellite Overpasses: {sat_c['actual_start_date']} -> {sat_c['actual_end_date']}")
        print(f"     Data Source: {sat_c['imagery_source']}")
        print(f"     Total Disturbance: {m_c['total_disturbance_ha']} ha")
        print(f"     Inside Disturbance: {m_c['inside_disturbance_ha']} ha")
        print(f"     Outside Encroachment: {m_c['outside_disturbance_ha']} ha")
        print(f"     Vegetation Loss: {m_c['vegetation_loss_ha']} ha")
        print(f"     Encroachment Alert: {m_c['encroachment_alert']}")
        assert m_c["total_disturbance_ha"] > 0, "Annual disturbance must be detected!"
        assert m_c["total_disturbance_ha"] != m_b["total_disturbance_ha"], "Quarterly and Annual date windows must yield distinct results!"
        assert m_c["outside_disturbance_ha"] > 0, "Annual period must trigger unpermitted boundary encroachment!"
        assert m_c["encroachment_alert"] is True

    # -------------------------------------------------------------
    # TEST 5: Verify That Results Completely Differ Across Date Windows
    # -------------------------------------------------------------
    print("\n[TEST 5] Comparing Metrics Across Observation Periods...")
    print(f"     Case A (Same Date):      Total = {m_a['total_disturbance_ha']:.2f} ha | Outside = {m_a['outside_disturbance_ha']:.2f} ha")
    print(f"     Case B (Quarterly):      Total = {m_b['total_disturbance_ha']:.2f} ha | Outside = {m_b['outside_disturbance_ha']:.2f} ha")
    print(f"     Case C (Annual Extended): Total = {m_c['total_disturbance_ha']:.2f} ha | Outside = {m_c['outside_disturbance_ha']:.2f} ha")
    assert m_a["total_disturbance_ha"] != m_b["total_disturbance_ha"], "Cases A and B must differ!"
    assert m_b["total_disturbance_ha"] != m_c["total_disturbance_ha"], "Cases B and C must differ!"
    print("[OK] Results are verified to be strictly date-dependent. No stale results reused.")

    # -------------------------------------------------------------
    # TEST 6: Verify PDF Generation and Embedded Map Images for Case C
    # -------------------------------------------------------------
    print("\n[TEST 6] Verifying PDF Dossier and Embedded Cartographic Map Products...")
    pdf_url = f"http://127.0.0.1:8000/api/reports/{res_c['analysis_id']}/download"
    with urllib.request.urlopen(pdf_url) as resp:
        pdf_bytes = resp.read()
        print(f"[OK] Downloaded PDF Size: {len(pdf_bytes):,} bytes")
        print(f"     Content-Type: {resp.headers.get('Content-Type')}")
        assert pdf_bytes.startswith(b'%PDF'), "Downloaded file must be a valid PDF document!"

    # Check that image files exist on disk in reports directory
    reports_dir = Path("app/data/reports")
    before_png = reports_dir / f"{res_c['analysis_id']}_before.png"
    after_png = reports_dir / f"{res_c['analysis_id']}_after.png"
    overlay_png = reports_dir / f"{res_c['analysis_id']}_overlay.png"

    print(f"[OK] Checking persistent map files on disk:")
    print(f"     • T1 Baseline Map: {before_png.exists()} ({os.path.getsize(before_png):,} bytes)" if before_png.exists() else "Missing")
    print(f"     • T2 Recent Map:   {after_png.exists()} ({os.path.getsize(after_png):,} bytes)" if after_png.exists() else "Missing")
    print(f"     • Change Overlay:  {overlay_png.exists()} ({os.path.getsize(overlay_png):,} bytes)" if overlay_png.exists() else "Missing")

    assert before_png.exists() and os.path.getsize(before_png) > 10000, "T1 Baseline map image must exist on disk and be non-empty!"
    assert after_png.exists() and os.path.getsize(after_png) > 10000, "T2 Recent map image must exist on disk and be non-empty!"
    assert overlay_png.exists() and os.path.getsize(overlay_png) > 10000, "Change overlay map image must exist on disk and be non-empty!"

    # -------------------------------------------------------------
    # TEST 7: Verify KML Export
    # -------------------------------------------------------------
    print("\n[TEST 7] Verifying Google Earth KML Export for Case C...")
    kml_url = f"http://127.0.0.1:8000/api/reports/{res_c['analysis_id']}/kml"
    with urllib.request.urlopen(kml_url) as resp:
        kml_str = resp.read().decode('utf-8')
        print(f"[OK] Downloaded KML characters: {len(kml_str):,}")
        assert "POTENTIAL BOUNDARY ENCROACHMENT" in kml_str
        assert "1 KM Surrounding Monitoring Zone" in kml_str

    print("\n===================================================================")
    print("ALL 7 DATE-DRIVEN VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("===================================================================")
    return True

if __name__ == '__main__':
    test_date_driven_analysis()
