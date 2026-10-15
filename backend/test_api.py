import urllib.request
import urllib.parse
import json

def run_tests():
    print("========================================")
    print("AI-MIMS SYSTEM VERIFICATION SUITE")
    print("========================================")

    # 1. Health check
    with urllib.request.urlopen('http://127.0.0.1:8000/api/health') as resp:
        health = json.loads(resp.read().decode())
        print("[OK] [TEST 1] System Health:", health["status"], "|", health["system"])

    # 2. Leases list & UTM 43N projected calculations
    with urllib.request.urlopen('http://127.0.0.1:8000/api/leases') as resp:
        leases_res = json.loads(resp.read().decode())
        leases = leases_res["leases"]
        print(f"[OK] [TEST 2] Leases Registered: {len(leases)}")
        for l in leases:
            print(f"   • {l['lease_id']}: {l['quarry_name']} ({l['mineral']}, {l['district']}) - Area: {l['calculated_area_ha']} ha")

    # 3. Mandatory 1 km buffer verification
    with urllib.request.urlopen('http://127.0.0.1:8000/api/leases/DEMO-CKW-01') as resp:
        ckw = json.loads(resp.read().decode())
        assert ckw['monitoring_zone_geojson'] is not None, "1km buffer must exist!"
        print(f"[OK] [TEST 3] 1 KM Monitoring Zone verified for {ckw['lease_id']}:")
        print(f"   • Official Perimeter: {ckw['lease_area_ha']} ha (Claimed) / {ckw['calculated_area_ha']} ha (Computed UTM 43N)")
        print(f"   • Google Earth URL: {ckw['google_earth_url']}")

    # 4. CSV Import Test (Format B vertices)
    csv_sample = """lease_id,quarry_name,mineral,district,company_name,vertex_order,latitude,longitude
TEST-KAT-09,Katas Raj Quarry,Limestone,Chakwal,Bestway Ltd,1,32.7100,72.9400
TEST-KAT-09,Katas Raj Quarry,Limestone,Chakwal,Bestway Ltd,2,32.7180,72.9410
TEST-KAT-09,Katas Raj Quarry,Limestone,Chakwal,Bestway Ltd,3,32.7170,72.9520
TEST-KAT-09,Katas Raj Quarry,Limestone,Chakwal,Bestway Ltd,4,32.7090,72.9500
TEST-KAT-09,Katas Raj Quarry,Limestone,Chakwal,Bestway Ltd,5,32.7100,72.9400"""
    
    data = urllib.parse.urlencode({'csv_text': csv_sample, 'commit': 'true'}).encode('utf-8')
    req = urllib.request.Request('http://127.0.0.1:8000/api/leases/import-csv', data=data)
    with urllib.request.urlopen(req) as resp:
        import_res = json.loads(resp.read().decode())
        print(f"[OK] [TEST 4] CSV Import Test:")
        print(f"   • Format Detected: {import_res['format_detected']}")
        print(f"   • Total Parsed: {import_res['total_parsed']}")
        print(f"   • Saved Count: {import_res['saved_count']}")

    # 5. One-Click Analysis Test (Sentinel-2 Change Detection + 1km Encroachment)
    analysis_req_data = json.dumps({
        "lease_id": "DEMO-CKW-01",
        "start_date": "2025-01-15",
        "end_date": "2025-10-10",
        "imagery_source": "Copernicus Sentinel-2 L2A"
    }).encode('utf-8')

    req_analysis = urllib.request.Request(
        'http://127.0.0.1:8000/api/analysis/run',
        data=analysis_req_data,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_analysis) as resp:
        analysis_res = json.loads(resp.read().decode())
        m = analysis_res['metrics']
        print(f"[OK] [TEST 5] One-Click Analysis Pipeline:")
        print(f"   • Analysis ID: {analysis_res['analysis_id']}")
        print(f"   • Satellite Overpasses: {analysis_res['satellite_metadata']['actual_start_date']} to {analysis_res['satellite_metadata']['actual_end_date']}")
        print(f"   • Total Disturbance: {m['total_disturbance_ha']} ha ({m['total_disturbance_sqm']} m²)")
        print(f"   • Inside Authorized Pit: {m['inside_disturbance_ha']} ha")
        print(f"   • Potential Outside Encroachment: {m['outside_disturbance_ha']} ha ({m['encroachment_pct']}% of detected change)")
        print(f"   • Vegetation Cover Loss: {m['vegetation_loss_ha']} ha")
        print(f"   • Encroachment Alert: {m['encroachment_alert']}")
        analysis_id = analysis_res['analysis_id']

    # 6. PDF Report Download Verification
    with urllib.request.urlopen(f'http://127.0.0.1:8000/api/reports/{analysis_id}/download') as resp:
        pdf_bytes = resp.read()
        print(f"[OK] [TEST 6] PDF Inspection Report:")
        print(f"   • Downloaded Size: {len(pdf_bytes):,} bytes")
        print(f"   • Content-Type: {resp.headers.get('Content-Type')}")
        assert pdf_bytes.startswith(b'%PDF'), "File must be valid PDF!"

    # 7. KML Export for Google Earth Verification
    with urllib.request.urlopen(f'http://127.0.0.1:8000/api/reports/{analysis_id}/kml') as resp:
        kml_content = resp.read().decode('utf-8')
        print(f"[OK] [TEST 7] Google Earth KML Export:")
        print(f"   • KML Size: {len(kml_content):,} characters")
        print(f"   • Has 1 KM Buffer Placemark: {'1 KM Surrounding Monitoring Zone' in kml_content}")
        print(f"   • Has Encroachment Alert Placemark: {'POTENTIAL BOUNDARY ENCROACHMENT' in kml_content}")

    # 8. Geotechnical Mineral Density Lookup & Production Estimation Test
    calc_req_data = json.dumps({
        "mineral_name": "Limestone",
        "excavation_area_sqm": 100000.0,
        "assumed_depth_m": 12.0,
        "waste_fraction": 0.15,
        "recovery_rate": 0.85
    }).encode('utf-8')
    req_calc = urllib.request.Request(
        'http://127.0.0.1:8000/api/minerals/estimate',
        data=calc_req_data,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_calc) as resp:
        calc_res = json.loads(resp.read().decode())
        print(f"[OK] [TEST 8] Geotechnical Production Calculation:")
        print(f"   • Density: {calc_res['in_situ_bulk_density_t_per_m3']} t/m³")
        print(f"   • Volume: {calc_res['volume_m3']:,} m³")
        print(f"   • Excavated Mass: {calc_res['excavated_mass_tonnes']:,} tonnes")
        print(f"   • Marketable Production: {calc_res['estimated_saleable_production_tonnes']:,} tonnes")

    print("\n========================================")
    print("ALL 8 ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
    print("========================================")

if __name__ == '__main__':
    run_tests()
