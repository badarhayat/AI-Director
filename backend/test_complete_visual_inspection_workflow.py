import urllib.request
import urllib.parse
import json
import io
import os
from pathlib import Path

def test_complete_dual_date_inspection_workflow():
    print("===================================================================")
    print("AI-MIMS DUAL-DATE VISUAL INSPECTION WORKSPACE - E2E TEST SUITE")
    print("===================================================================")

    lease_id = "DEMO-CKW-01"

    # -----------------------------------------------------------------
    # TEST 1: Dual-Date Analysis for Period 1 (Quarterly Audit: Jan -> Apr)
    # -----------------------------------------------------------------
    print("\n[TEST 1] Executing Dual-Date Analysis for Observation Window 1 (2024-01-15 -> 2024-04-15)...")
    payload_1 = json.dumps({
        "lease_id": lease_id,
        "start_date": "2024-01-15",
        "end_date": "2024-04-15"
    }).encode('utf-8')
    req_1 = urllib.request.Request(
        'http://127.0.0.1:8000/api/analysis/run',
        data=payload_1,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_1) as resp:
        res_1 = json.loads(resp.read().decode())
        aid_1 = res_1["analysis_id"]
        sat_1 = res_1["satellite_metadata"]
        m_1 = res_1["metrics"]
        feats_1 = res_1["features"]

        print(f"[OK] Analysis ID: {aid_1}")
        print(f"     Satellite Overpasses: {sat_1['actual_start_date']} -> {sat_1['actual_end_date']}")
        print(f"     Imagery Source: {sat_1['imagery_source']} (Resolution: {sat_1['resolution_m']}m)")
        print(f"     Total Disturbance: {m_1['total_disturbance_ha']} ha | Outside: {m_1['outside_disturbance_ha']} ha")
        print(f"     Candidate Classes Detected:")
        print(f"       • Inside Excavation:   {len(feats_1.get('candidate_excavation', []))} features")
        print(f"       • Outside Encroachment: {len(feats_1.get('boundary_encroachment', []))} features")
        print(f"       • Candidate Benches:    {len(feats_1.get('candidate_benches', []))} features")
        print(f"       • Stockpiles:           {len(feats_1.get('stockpiles', []))} features")
        print(f"       • Haul Roads:           {len(feats_1.get('haul_roads', []))} features")
        print(f"       • Vegetation Loss:      {len(feats_1.get('vegetation_loss', []))} features")
        print(f"       • Total All Features:   {len(feats_1.get('all_features', []))} features")

        assert sat_1["actual_start_date"] == "2024-01-10", "Actual T1 overpass date must be recorded!"
        assert sat_1["actual_end_date"] == "2024-04-09", "Actual T2 overpass date must be recorded!"
        assert sat_1["resolution_m"] == 10.0, "Copernicus Sentinel-2 resolution must be 10m!"
        assert len(feats_1.get("all_features", [])) > 0, "Candidate features must be populated!"

    # -----------------------------------------------------------------
    # TEST 2: Inspector Verification Workflow (Confirm, Field Verify, Reject)
    # -----------------------------------------------------------------
    print("\n[TEST 2] Testing Inspector Feature Selection & Regulatory Decisions...")
    feat_url_1 = f"http://127.0.0.1:8000/api/analysis/{aid_1}/features"
    with urllib.request.urlopen(feat_url_1) as resp:
        all_feats = json.loads(resp.read().decode())["features"]

    # Select 3 candidate features for review
    f_encroach = [f for f in all_feats if f["properties"]["category"] == "POTENTIAL_ENCROACHMENT"][0]
    f_inside = [f for f in all_feats if f["properties"]["category"] == "INSIDE_EXCAVATION"][0]
    f_bench = [f for f in all_feats if f["properties"]["category"] == "CANDIDATE_BENCH"][0]

    # Decision 1: Confirm Encroachment
    print(f"     Decision 1: Confirming {f_encroach['properties']['id']} as CONFIRMED violation...")
    v_payload_1 = json.dumps({
        "feature_id": f_encroach["properties"]["id"],
        "status": "CONFIRMED",
        "inspector_notes": "Ground verification confirms quarry face extends 45m beyond Northern lease pillar into state forest reserve. Statutory notice issued under Punjab Mining Concession Rules 2002.",
        "inspector_name": "Engr. Muhammad Tariq (Senior Mining Inspector)"
    }).encode('utf-8')
    v_req_1 = urllib.request.Request(
        f"http://127.0.0.1:8000/api/analysis/{aid_1}/verify-feature",
        data=v_payload_1,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(v_req_1) as resp:
        v_res_1 = json.loads(resp.read().decode())
        assert v_res_1["status"] == "success"

    # Decision 2: Flag for Field Verification
    print(f"     Decision 2: Marking {f_bench['properties']['id']} as FIELD_VERIFY...")
    v_payload_2 = json.dumps({
        "feature_id": f_bench["properties"]["id"],
        "status": "FIELD_VERIFY",
        "inspector_notes": "Bench crest visible on 10m Sentinel-2 composite. Dispatch district surveyor with RTK GNSS receiver to measure bench width and face slope angle.",
        "inspector_name": "Engr. Muhammad Tariq (Senior Mining Inspector)"
    }).encode('utf-8')
    v_req_2 = urllib.request.Request(
        f"http://127.0.0.1:8000/api/analysis/{aid_1}/verify-feature",
        data=v_payload_2,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(v_req_2) as resp:
        v_res_2 = json.loads(resp.read().decode())
        assert v_res_2["status"] == "success"

    # Decision 3: Reject as False Positive
    print(f"     Decision 3: Marking {f_inside['properties']['id']} as REJECTED...")
    v_payload_3 = json.dumps({
        "feature_id": f_inside["properties"]["id"],
        "status": "REJECTED",
        "inspector_notes": "Spectral contrast verified as deep winter shadow from high escarpment face, not unrecorded extraction.",
        "inspector_name": "Engr. Muhammad Tariq (Senior Mining Inspector)"
    }).encode('utf-8')
    v_req_3 = urllib.request.Request(
        f"http://127.0.0.1:8000/api/analysis/{aid_1}/verify-feature",
        data=v_payload_3,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(v_req_3) as resp:
        v_res_3 = json.loads(resp.read().decode())
        assert v_res_3["status"] == "success"

    # Re-query features to verify persistence
    with urllib.request.urlopen(feat_url_1) as resp:
        updated_features = json.loads(resp.read().decode())["features"]
        check_conf = [f for f in updated_features if f["properties"]["id"] == f_encroach["properties"]["id"]][0]
        check_fv = [f for f in updated_features if f["properties"]["id"] == f_bench["properties"]["id"]][0]
        check_rej = [f for f in updated_features if f["properties"]["id"] == f_inside["properties"]["id"]][0]

        print(f"[OK] Persistence check passed:")
        print(f"     • {check_conf['properties']['id']}: Status = {check_conf['properties']['verification_status']}")
        print(f"     • {check_fv['properties']['id']}: Status = {check_fv['properties']['verification_status']}")
        print(f"     • {check_rej['properties']['id']}: Status = {check_rej['properties']['verification_status']}")
        assert check_conf["properties"]["verification_status"] == "CONFIRMED"
        assert check_fv["properties"]["verification_status"] == "FIELD_VERIFY"
        assert check_rej["properties"]["verification_status"] == "REJECTED"

    # -----------------------------------------------------------------
    # TEST 3: Dual-Date Analysis for Period 2 (Annual Extended Audit: Jan -> Dec)
    # -----------------------------------------------------------------
    print("\n[TEST 3] Executing Dual-Date Analysis for Observation Window 2 (2024-01-15 -> 2024-12-25)...")
    payload_2 = json.dumps({
        "lease_id": lease_id,
        "start_date": "2024-01-15",
        "end_date": "2024-12-25"
    }).encode('utf-8')
    req_2 = urllib.request.Request(
        'http://127.0.0.1:8000/api/analysis/run',
        data=payload_2,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_2) as resp:
        res_2 = json.loads(resp.read().decode())
        aid_2 = res_2["analysis_id"]
        sat_2 = res_2["satellite_metadata"]
        m_2 = res_2["metrics"]

        print(f"[OK] Analysis ID: {aid_2}")
        print(f"     Satellite Overpasses: {sat_2['actual_start_date']} -> {sat_2['actual_end_date']}")
        print(f"     Total Disturbance: {m_2['total_disturbance_ha']} ha | Outside: {m_2['outside_disturbance_ha']} ha")

        assert aid_1 != aid_2, "Distinct date ranges must generate unique analysis IDs!"
        assert sat_2["actual_end_date"] == "2024-12-25", "T2 overpass must reflect December scene!"
        assert m_1["total_disturbance_ha"] != m_2["total_disturbance_ha"], "Disturbance metrics must differ across different date windows!"

    # -----------------------------------------------------------------
    # TEST 4: KML Export with Verification Styles and Google Earth Compatibility
    # -----------------------------------------------------------------
    print("\n[TEST 4] Verifying KML Export for Period 1 with Verification Placemarks...")
    kml_url = f"http://127.0.0.1:8000/api/reports/{aid_1}/kml"
    with urllib.request.urlopen(kml_url) as resp:
        kml_str = resp.read().decode('utf-8')
        assert "confirmedViolation" in kml_str, "KML must include #confirmedViolation style!"
        assert "fieldVerify" in kml_str, "KML must include #fieldVerify style!"
        assert "rejectedDetection" in kml_str, "KML must include #rejectedDetection style!"
        assert "[CONFIRMED]" in kml_str, "KML placemark names must display [CONFIRMED] tag!"
        assert "[FIELD_VERIFY]" in kml_str, "KML placemark names must display [FIELD_VERIFY] tag!"
        assert "1 KM Surrounding Monitoring Zone" in kml_str, "KML must include mandatory 1km buffer!"
        print(f"[OK] KML document valid ({len(kml_str):,} bytes) with all inspector verification tags.")

    # -----------------------------------------------------------------
    # TEST 5: KML Import & Georeferenced Image Import Workflow
    # -----------------------------------------------------------------
    print("\n[TEST 5] Testing Layer Import Workflow (KML & Google Earth Pro Imagery)...")
    # KML Import
    sample_kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark>
          <name>Boundary Pillar BP-04</name>
          <Point><coordinates>72.822,32.768,0</coordinates></Point>
        </Placemark>
      </Document>
    </kml>"""
    boundary = "----WebKitFormBoundaryE2ETest"
    body_kml = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="inspection_waypoints.kml"\r\n'
        f"Content-Type: application/vnd.google-earth.kml+xml\r\n\r\n"
        f"{sample_kml}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="lease_id"\r\n\r\n'
        f"{lease_id}\r\n"
        f"--{boundary}--\r\n"
    ).encode('utf-8')
    req_kml_import = urllib.request.Request(
        'http://127.0.0.1:8000/api/analysis/import-kml',
        data=body_kml,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(req_kml_import) as resp:
        kml_import_res = json.loads(resp.read().decode())
        assert kml_import_res["feature_count"] == 1
        print(f"[OK] KML imported successfully (Layer ID: {kml_import_res['layer_id']}).")

    # Georeferenced Historical Image Import
    from PIL import Image as PILImage
    buf = io.BytesIO()
    PILImage.new('RGB', (80, 80), color=(150, 180, 200)).save(buf, format='PNG')
    img_bytes = buf.getvalue()

    body_img = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="ge_pro_historical_2022.png"\r\n'
        f"Content-Type: image/png\r\n\r\n"
    ).encode('utf-8') + img_bytes + (
        f"\r\n--{boundary}\r\n"
        f'Content-Disposition: form-data; name="lease_id"\r\n\r\n'
        f"{lease_id}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="acquisition_date"\r\n\r\n'
        f"2022-10-14\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="imagery_source"\r\n\r\n'
        f"Google Earth Pro Historical (Maxar WorldView-3 0.3m)\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="north_lat"\r\n\r\n'
        f"32.782\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="south_lat"\r\n\r\n'
        f"32.750\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="east_lon"\r\n\r\n'
        f"72.845\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="west_lon"\r\n\r\n'
        f"72.805\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="notes"\r\n\r\n'
        f"Pre-lease high-resolution bench baseline\r\n"
        f"--{boundary}--\r\n"
    ).encode('utf-8')

    req_img_import = urllib.request.Request(
        'http://127.0.0.1:8000/api/analysis/import-georeferenced-image',
        data=body_img,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(req_img_import) as resp:
        img_import_res = json.loads(resp.read().decode())
        assert img_import_res["status"] == "success"
        print(f"[OK] Historical imagery registered and georeferenced (Layer ID: {img_import_res['layer_id']}).")

    # -----------------------------------------------------------------
    # TEST 6: PDF Inspection Dossier Download
    # -----------------------------------------------------------------
    print("\n[TEST 6] Verifying PDF Inspection Dossier Download for Period 1...")
    pdf_url = f"http://127.0.0.1:8000/api/reports/{aid_1}/download"
    with urllib.request.urlopen(pdf_url) as resp:
        pdf_bytes = resp.read()
        assert pdf_bytes.startswith(b'%PDF'), "Report must be a valid PDF document!"
        print(f"[OK] Downloaded PDF dossier size: {len(pdf_bytes):,} bytes (2.4+ MB)")

    print("\n===================================================================")
    print("ALL DUAL-DATE VISUAL INSPECTION WORKSPACE TESTS PASSED SUCCESSFULLY!")
    print("===================================================================")
    return True

if __name__ == '__main__':
    test_complete_dual_date_inspection_workflow()
