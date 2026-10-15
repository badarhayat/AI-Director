import urllib.request
import urllib.parse
import json
import io
from pathlib import Path

def test_inspection_workspace_backend():
    print("===================================================================")
    print("AI-MIMS VISUAL INSPECTION WORKSPACE BACKEND VERIFICATION")
    print("===================================================================")

    lease_id = "DEMO-CKW-01"

    # 1. Run Analysis
    print("\n[STEP 1] Running Analysis for DEMO-CKW-01...")
    payload = json.dumps({
        "lease_id": lease_id,
        "start_date": "2024-01-15",
        "end_date": "2024-04-15"
    }).encode('utf-8')
    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/analysis/run',
        data=payload,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        analysis_id = res["analysis_id"]
        features = res["features"]
        print(f"[OK] Analysis ID: {analysis_id}")
        print(f"     Inside features: {len(features.get('inside', []))}")
        print(f"     Outside features: {len(features.get('outside', []))}")
        print(f"     Candidate benches: {len(features.get('candidate_benches', []))}")
        print(f"     Stockpiles: {len(features.get('stockpiles', []))}")
        print(f"     Haul roads: {len(features.get('haul_roads', []))}")
        print(f"     All features: {len(features.get('all_features', []))}")
        assert len(features.get('all_features', [])) > 0, "Candidate features must be generated!"

    # 2. Get Features Endpoint
    print("\n[STEP 2] Fetching features via GET /api/analysis/{analysis_id}/features...")
    feat_url = f"http://127.0.0.1:8000/api/analysis/{analysis_id}/features"
    with urllib.request.urlopen(feat_url) as resp:
        feat_res = json.loads(resp.read().decode())
        feature_list = feat_res["features"]
        print(f"[OK] Retrieved {len(feature_list)} features from database.")
        assert len(feature_list) > 0, "Database must return detected features"
        first_feat = feature_list[0]
        first_feat_id = first_feat["properties"]["id"]
        print(f"     Target Feature: {first_feat_id} ({first_feat['properties']['feature_type']}) - Status: {first_feat['properties']['verification_status']}")

    # 3. Test Feature Verification (Inspector confirms a feature)
    print(f"\n[STEP 3] Marking {first_feat_id} as CONFIRMED...")
    verify_payload = json.dumps({
        "feature_id": first_feat_id,
        "status": "CONFIRMED",
        "inspector_notes": "Ground-truthed unpermitted quarry expansion along Northern pillar. Violation notice issued.",
        "inspector_name": "Engr. Tariq Mahmood (Senior Inspector, DGM&M)"
    }).encode('utf-8')
    v_req = urllib.request.Request(
        f"http://127.0.0.1:8000/api/analysis/{analysis_id}/verify-feature",
        data=verify_payload,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(v_req) as resp:
        v_res = json.loads(resp.read().decode())
        print(f"[OK] Verification response: {v_res}")
        assert v_res["status"] == "success"
        assert v_res["verification_status"] == "CONFIRMED"

    # Re-fetch features and assert status updated
    with urllib.request.urlopen(feat_url) as resp:
        feat_res_updated = json.loads(resp.read().decode())
        updated_feat = [f for f in feat_res_updated["features"] if f["properties"]["id"] == first_feat_id][0]
        print(f"[OK] Verified feature in DB: Status = {updated_feat['properties']['verification_status']}")
        print(f"     Inspector notes = '{updated_feat['properties']['inspector_notes']}'")
        assert updated_feat["properties"]["verification_status"] == "CONFIRMED"
        assert "Violation notice issued" in updated_feat["properties"]["inspector_notes"]

    # 4. Test KML Export with Verification Status
    print("\n[STEP 4] Verifying KML Export reflects CONFIRMED status...")
    kml_url = f"http://127.0.0.1:8000/api/reports/{analysis_id}/kml"
    with urllib.request.urlopen(kml_url) as resp:
        kml_content = resp.read().decode('utf-8')
        assert "confirmedViolation" in kml_content
        assert "[CONFIRMED]" in kml_content
        print("[OK] KML contains #confirmedViolation style and [CONFIRMED] placemark tag.")

    # 5. Test KML Import Endpoint
    print("\n[STEP 5] Testing POST /api/analysis/import-kml...")
    sample_kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark>
          <name>GPS Field Survey Waypoint 1</name>
          <description>Physical marker pillar inspected on-site</description>
          <Point>
            <coordinates>72.825,32.765,740</coordinates>
          </Point>
        </Placemark>
        <Placemark>
          <name>Handheld GPS Inspection Track</name>
          <LineString>
            <coordinates>72.820,32.760,0 72.825,32.765,0 72.830,32.770,0</coordinates>
          </LineString>
        </Placemark>
      </Document>
    </kml>
    """
    boundary = "----WebKitFormBoundaryAI_MIMS_TEST"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="field_survey.kml"\r\n'
        f"Content-Type: application/vnd.google-earth.kml+xml\r\n\r\n"
        f"{sample_kml}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="lease_id"\r\n\r\n'
        f"{lease_id}\r\n"
        f"--{boundary}--\r\n"
    ).encode('utf-8')

    kml_req = urllib.request.Request(
        'http://127.0.0.1:8000/api/analysis/import-kml',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(kml_req) as resp:
        kml_import_res = json.loads(resp.read().decode())
        print(f"[OK] KML Imported layer ID: {kml_import_res['layer_id']}")
        print(f"     Feature count: {kml_import_res['feature_count']}")
        assert kml_import_res["feature_count"] == 2
        assert kml_import_res["geojson"]["features"][0]["properties"]["name"] == "GPS Field Survey Waypoint 1"

    # 6. Test Georeferenced Image Import Endpoint
    print("\n[STEP 6] Testing POST /api/analysis/import-georeferenced-image...")
    # Generate 100x100 fake png image bytes
    from PIL import Image as TestImg
    buf = io.BytesIO()
    TestImg.new('RGB', (100, 100), color=(120, 150, 180)).save(buf, format='PNG')
    img_bytes = buf.getvalue()

    img_body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="ge_pro_historical_2023.png"\r\n'
        f"Content-Type: image/png\r\n\r\n"
    ).encode('utf-8') + img_bytes + (
        f"\r\n--{boundary}\r\n"
        f'Content-Disposition: form-data; name="lease_id"\r\n\r\n'
        f"{lease_id}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="acquisition_date"\r\n\r\n'
        f"2023-04-20\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="imagery_source"\r\n\r\n'
        f"Google Earth Pro Export (Maxar 0.5m)\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="north_lat"\r\n\r\n'
        f"32.780\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="south_lat"\r\n\r\n'
        f"32.750\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="east_lon"\r\n\r\n'
        f"72.840\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="west_lon"\r\n\r\n'
        f"72.800\r\n"
        f"--{boundary}--\r\n"
    ).encode('utf-8')

    img_req = urllib.request.Request(
        'http://127.0.0.1:8000/api/analysis/import-georeferenced-image',
        data=img_body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(img_req) as resp:
        img_import_res = json.loads(resp.read().decode())
        print(f"[OK] Historical Image Layer ID: {img_import_res['layer_id']}")
        print(f"     Image URL: {img_import_res['image_url']}")
        print(f"     Bounds: {img_import_res['bounds']}")
        assert img_import_res["status"] == "success"
        layer_id = img_import_res["layer_id"]

    # Test downloading the imported image
    with urllib.request.urlopen(f"http://127.0.0.1:8000/api/analysis/imported-image/{layer_id}") as resp:
        downloaded_img = resp.read()
        print(f"[OK] Retrieved imported image from server: {len(downloaded_img)} bytes")
        assert len(downloaded_img) > 0

    print("\n===================================================================")
    print("ALL VISUAL INSPECTION WORKSPACE BACKEND TESTS PASSED SUCCESSFULLY!")
    print("===================================================================")
    return True

if __name__ == '__main__':
    test_inspection_workspace_backend()
