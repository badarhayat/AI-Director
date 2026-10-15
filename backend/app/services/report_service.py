import os
import io
import base64
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from PIL import Image as PILImage
from app.config import REPORTS_DIR

def build_pdf_report(analysis_data: Dict[str, Any], lease_data: Dict[str, Any], output_path: Optional[str] = None) -> str:
    """
    Generates a formal, two-page government-grade PDF inspection dossier using ReportLab.
    Page 1: Regulatory metadata, Concession specs, quantitative compliance table, and geotechnical mass estimates.
    Page 2: High-resolution annotated satellite imagery comparison (T1 vs T2 vs Change Overlay), symbology legend, and formal sign-off.
    """
    analysis_id = analysis_data.get("id", f"REP-{int(datetime.utcnow().timestamp())}")
    if output_path is None:
        output_path = str(REPORTS_DIR / f"{analysis_id}.pdf")

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=32,
        bottomMargin=32
    )

    styles = getSampleStyleSheet()

    header_style = ParagraphStyle(
        'GovHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=17,
        textColor=colors.HexColor('#0F172A'),
        alignment=1
    )

    sub_header_style = ParagraphStyle(
        'GovSubHeader',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#334155'),
        alignment=1
    )

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#1E3A8A'),
        alignment=1
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=6,
        spaceAfter=3
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#1E293B')
    )

    alert_style = ParagraphStyle(
        'Alert',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#B91C1C')
    )

    disclaimer_style = ParagraphStyle(
        'Disclaimer',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#92400E'),
        alignment=1
    )

    story = []

    # ==========================================
    # PAGE 1: REGULATORY AUDIT & QUANTITATIVE FINDINGS
    # ==========================================

    story.append(Paragraph("GOVERNMENT OF THE PUNJAB", header_style))
    story.append(Paragraph("DIRECTORATE GENERAL OF MINES & MINERALS (DGM&M)", sub_header_style))
    story.append(Paragraph("AI MINING INSPECTION AND MONITORING SYSTEM (AI-MIMS)", sub_header_style))
    story.append(Spacer(1, 3))
    story.append(Paragraph("OFFICIAL SATELLITE QUARRY SURVEILLANCE & BOUNDARY COMPLIANCE DOSSIER", title_style))
    story.append(Spacer(1, 4))

    # Demo Banner if applicable
    is_demo = analysis_data.get("is_demo", True)
    if is_demo:
        demo_box = Table(
            [[Paragraph("DEMONSTRATION REPORT: RESULTS ARE ILLUSTRATIVE FOR EVALUATION AND MUST NOT BE TREATED AS OFFICIAL INSPECTION FINDINGS.", disclaimer_style)]],
            colWidths=[523]
        )
        demo_box.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FEF3C7')),
            ('BORDER', (0,0), (-1,-1), 1, colors.HexColor('#F59E0B')),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(demo_box)
        story.append(Spacer(1, 4))

    # Meta Bar
    meta_table = Table([
        [
            Paragraph(f"<b>Dossier ID:</b> {analysis_id}", body_style),
            Paragraph(f"<b>Inspection Date:</b> {datetime.now().strftime('%d-%b-%Y')}", body_style),
            Paragraph(f"<b>Review Status:</b> {analysis_data.get('review_status', 'PENDING_REVIEW')}", body_style)
        ]
    ], colWidths=[210, 150, 163])
    meta_table.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 1),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 5))

    # Section 1: Concession & Spatial Profile
    story.append(Paragraph("1. CONCESSION SPECIFICATIONS & SURVEILLANCE PARAMETERS", section_heading))
    concession_data = [
        [
            Paragraph("<b>Lease ID:</b>", body_style), Paragraph(str(lease_data.get("lease_id")), body_style),
            Paragraph("<b>Quarry Name:</b>", body_style), Paragraph(str(lease_data.get("quarry_name")), body_style)
        ],
        [
            Paragraph("<b>Mineral:</b>", body_style), Paragraph(str(lease_data.get("mineral")), body_style),
            Paragraph("<b>District:</b>", body_style), Paragraph(str(lease_data.get("district")), body_style)
        ],
        [
            Paragraph("<b>Licensed Lessee:</b>", body_style), Paragraph(str(lease_data.get("company_name", "Licensed Operator")), body_style),
            Paragraph("<b>Official Concession Area:</b>", body_style), Paragraph(f"{lease_data.get('lease_area_ha', 0):.2f} ha ({float(lease_data.get('calculated_area_ha', 0)):.2f} ha computed UTM 43N)", body_style)
        ],
        [
            Paragraph("<b>Surveillance Envelope:</b>", body_style), Paragraph("Official Perimeter + Mandatory 1,000m Outer Buffer", body_style),
            Paragraph("<b>Coordinate System:</b>", body_style), Paragraph("WGS 84 / UTM Zone 43N (EPSG:32643)", body_style)
        ],
        [
            Paragraph("<b>Satellite Sensor:</b>", body_style), Paragraph(str(analysis_data.get("imagery_source", "Copernicus Sentinel-2 MSI (10m)")), body_style),
            Paragraph("<b>Observation Overpasses:</b>", body_style), Paragraph(f"T1: {analysis_data.get('actual_start_date', 'N/A')} to T2: {analysis_data.get('actual_end_date', 'N/A')}", body_style)
        ]
    ]
    t_concession = Table(concession_data, colWidths=[120, 140, 130, 133])
    t_concession.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
    ]))
    story.append(t_concession)
    story.append(Spacer(1, 5))

    # Section 2: Quantitative Findings Table
    story.append(Paragraph("2. QUANTITATIVE SURFACE CHANGE DETECTION & COMPLIANCE FINDINGS", section_heading))

    has_encroachment = float(analysis_data.get("outside_disturbance_ha", 0.0)) > 0.0
    tot_dist = float(analysis_data.get("total_disturbance_ha", 0.0))
    encroach_text = "POTENTIAL BOUNDARY ENCROACHMENT" if has_encroachment else ("Zero Change Observed" if tot_dist == 0 else "Boundary Compliant")

    metrics_table_data = [
        [Paragraph("<b>Surveillance Metric</b>", body_style), Paragraph("<b>Observed Area (ha)</b>", body_style), Paragraph("<b>Metric Area (m²)</b>", body_style), Paragraph("<b>Compliance Status</b>", body_style)],
        [
            Paragraph("Total Detected New Disturbance", body_style),
            Paragraph(f"{analysis_data.get('total_disturbance_ha', 0):.3f} ha", body_style),
            Paragraph(f"{analysis_data.get('total_disturbance_sqm', 0):,.1f} m²", body_style),
            Paragraph(f"{analysis_data.get('change_pct_of_lease', 0):.2f}% of concession area", body_style)
        ],
        [
            Paragraph("Authorized Inside-Lease Disturbance", body_style),
            Paragraph(f"{analysis_data.get('inside_disturbance_ha', 0):.3f} ha", body_style),
            Paragraph(f"{analysis_data.get('inside_disturbance_sqm', 0):,.1f} m²", body_style),
            Paragraph("Within licensed concession boundary", body_style)
        ],
        [
            Paragraph("Potential Outside-Lease Excavation", body_style),
            Paragraph(f"<b>{analysis_data.get('outside_disturbance_ha', 0):.3f} ha</b>", alert_style if has_encroachment else body_style),
            Paragraph(f"{analysis_data.get('outside_disturbance_sqm', 0):,.1f} m²", body_style),
            Paragraph(f"<b>{encroach_text}</b>", alert_style if has_encroachment else body_style)
        ],
        [
            Paragraph("Vegetation Cover Loss (ΔNDVI < -0.18)", body_style),
            Paragraph(f"{analysis_data.get('ndvi_loss_ha', 0):.3f} ha", body_style),
            Paragraph(f"{float(analysis_data.get('ndvi_loss_ha', 0))*10000:,.1f} m²", body_style),
            Paragraph("Scrubland clearing in monitoring zone", body_style)
        ],
        [
            Paragraph("Stockpile / Overburden Shifts", body_style),
            Paragraph(f"{analysis_data.get('stockpile_change_ha', 0):.2f} ha", body_style),
            Paragraph(f"{float(analysis_data.get('stockpile_change_ha', 0))*10000:,.1f} m²", body_style),
            Paragraph("Requires dumping authorization check", body_style)
        ],
        [
            Paragraph("Haulage Roads / Access Expansion", body_style),
            Paragraph(f"{analysis_data.get('haul_roads_km', 0):.2f} km", body_style),
            Paragraph("Linear feature tracking", body_style),
            Paragraph("Approaching concession boundary", body_style)
        ]
    ]

    t_metrics = Table(metrics_table_data, colWidths=[173, 110, 110, 130])
    t_metrics.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#94A3B8')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
    ]))
    story.append(t_metrics)
    story.append(Spacer(1, 5))

    # Section 3: Geotechnical Production Estimates
    story.append(Paragraph("3. GEOTECHNICAL MASS & PRODUCTION ESTIMATE", section_heading))
    vol = analysis_data.get("volume_m3")
    mass = analysis_data.get("mass_tonnes")
    density = analysis_data.get("density_t_per_m3", 2.60)
    vol_text = f"{vol:,.1f} m³" if vol is not None else "Not reliably quantifiable (requires 3D DEM/LiDAR)"
    mass_text = f"{mass:,.1f} tonnes" if mass is not None else "Requires elevation difference surface"

    prod_data = [
        [Paragraph("<b>Assumed Mineral Type:</b>", body_style), Paragraph(str(lease_data.get("mineral", "Limestone")), body_style),
         Paragraph("<b>In-situ Bulk Density:</b>", body_style), Paragraph(f"{density:.2f} tonnes/m³ (SME Handbook)", body_style)],
        [Paragraph("<b>Estimated Excavated Volume:</b>", body_style), Paragraph(vol_text, body_style),
         Paragraph("<b>Estimated Mineral Mass:</b>", body_style), Paragraph(mass_text, body_style)],
        [Paragraph("<b>Scientific Limitation:</b>", body_style),
         Paragraph("Satellite imagery provides 2D surface area footprints. Volumetric excavation and commercial tonnage calculations strictly require before-and-after 3D Digital Elevation Models (DEM), LiDAR, or drone photogrammetry.", body_style)]
    ]
    t_prod = Table(prod_data, colWidths=[130, 131, 130, 132])
    t_prod.setStyle(TableStyle([
        ('SPAN', (1,2), (3,2)),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
    ]))
    story.append(t_prod)
    story.append(Spacer(1, 5))

    # Section 4: Recommendations
    story.append(Paragraph("4. REGULATORY ACTION INSTRUCTIONS", section_heading))
    if has_encroachment:
        rec_text = "<b>CRITICAL ACTION REQUIRED:</b> Immediate on-site field verification mandated. Issue formal notice to concessionaire. Coordinate with District Mining Officer to survey boundary coordinates using DGPS and verify illegal extraction beyond official boundary."
    elif tot_dist == 0:
        rec_text = "<b>Routine Monitoring:</b> Zero surface change detected across the concession and monitoring buffer between the selected observation dates."
    else:
        rec_text = "<b>Routine Surveillance:</b> Quarry activities appear confined within authorized boundaries. Continue bi-monthly satellite surveillance and verify environmental mitigation in 1km buffer."

    story.append(Paragraph(rec_text, body_style))

    # ==========================================
    # PAGE BREAK TO PAGE 2 (IMAGE EVIDENCE & SIGN-OFF)
    # ==========================================
    story.append(PageBreak())

    story.append(Paragraph("AI-MIMS SATELLITE SURVEILLANCE EVIDENCE & MAP PRODUCTS", header_style))
    story.append(Paragraph(f"Dossier ID: {analysis_id} | Concession: {lease_data.get('quarry_name')} ({lease_data.get('lease_id')})", sub_header_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph("5. SATELLITE IMAGERY EVIDENCE & CARTOGRAPHIC CHANGE OVERLAYS", section_heading))

    # Locate and embed the 3 annotated cartographic images
    # We check: 1) direct file paths, 2) REPORTS_DIR/{analysis_id}_*.png, 3) base64 strings
    before_img_path = analysis_data.get("before_path") or str(REPORTS_DIR / f"{analysis_id}_before.png")
    after_img_path = analysis_data.get("after_path") or str(REPORTS_DIR / f"{analysis_id}_after.png")
    overlay_img_path = analysis_data.get("overlay_path") or str(REPORTS_DIR / f"{analysis_id}_overlay.png")

    # If file doesn't exist on disk, check if base64 is provided and write it
    for path_candidate, b64_key in [
        (before_img_path, "rgb_before_b64"),
        (after_img_path, "rgb_after_b64"),
        (overlay_img_path, "rgb_overlay_b64")
    ]:
        if not os.path.exists(path_candidate):
            b64_val = analysis_data.get(b64_key)
            if b64_val and "," in b64_val:
                try:
                    with open(path_candidate, "wb") as f:
                        f.write(base64.b64decode(b64_val.split(",")[1]))
                except Exception:
                    pass

    # Build image row
    img_cells = []
    labels = [
        f"T1 Baseline ({analysis_data.get('actual_start_date', 'T1')})",
        f"T2 Recent ({analysis_data.get('actual_end_date', 'T2')})",
        "Change & Compliance Overlay"
    ]
    paths = [before_img_path, after_img_path, overlay_img_path]

    for label, img_p in zip(labels, paths):
        if os.path.exists(img_p):
            rl_img = RLImage(img_p, width=168, height=160)
            img_cells.append([Paragraph(f"<b>{label}</b>", body_style), rl_img])
        else:
            img_cells.append([Paragraph(f"<b>{label}</b>", body_style), Paragraph("<br/><br/>[Satellite Imagery Unavailable]<br/><br/>", body_style)])

    img_table = Table([
        [img_cells[0][0], img_cells[1][0], img_cells[2][0]],
        [img_cells[0][1], img_cells[1][1], img_cells[2][1]]
    ], colWidths=[174, 174, 175])
    img_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#94A3B8')),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(img_table)
    story.append(Spacer(1, 8))

    # Symbology Legend for the map products
    story.append(Paragraph("6. MAP SYMBOLOGY & CARTOGRAPHIC REFERENCE", section_heading))
    legend_data = [
        [
            Paragraph("<font color='#2563EB'>■</font> <b>Official Lease:</b> Blue", body_style),
            Paragraph("<font color='#06B6D4'>■</font> <b>1 KM Buffer:</b> Cyan Dashed", body_style),
            Paragraph("<font color='#DC2626'>■</font> <b>Inside Pit:</b> Red Fill", body_style),
            Paragraph("<font color='#EF4444'>■</font> <b>Encroachment:</b> Bright Red", body_style)
        ],
        [
            Paragraph("<font color='#DB2777'>■</font> <b>Vegetation Loss:</b> Magenta", body_style),
            Paragraph("<font color='#F97316'>■</font> <b>Stockpile / Dump:</b> Orange", body_style),
            Paragraph("<font color='#EAB308'>■</font> <b>Haul Roads:</b> Yellow", body_style),
            Paragraph("<font color='#1E3A8A'>■</font> <b>Hydrology:</b> Dark Blue", body_style)
        ]
    ]
    t_legend = Table(legend_data, colWidths=[130, 131, 131, 131])
    t_legend.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t_legend)
    story.append(Spacer(1, 10))

    # Section 7: Formal Inspector Sign-Off Block
    story.append(Paragraph("7. REGULATORY VERIFICATION & OFFICIAL APPROVALS", section_heading))
    sig_table = Table([
        [
            Paragraph("<b>Remote Sensing Analyst:</b>", body_style),
            Paragraph("<b>District Mining Officer (Field Check):</b>", body_style),
            Paragraph("<b>Director General Approval:</b>", body_style)
        ],
        [
            Paragraph("Engr. M. Farooq (GIS Lead)<br/>Senior Remote Sensing Officer, DGM&M<br/>Date: " + datetime.now().strftime("%d-%b-%Y") + "<br/>Status: <i>" + str(analysis_data.get("review_status", "PENDING_REVIEW")) + "</i><br/>Signature: ________________________", body_style),
            Paragraph("Name: ____________________________<br/>Assistant Director Mines & Minerals<br/>Field Survey Date: _________________<br/>Signature: ________________________", body_style),
            Paragraph("Official Regulatory Seal / Stamp:<br/><br/>__________________________________", body_style)
        ]
    ], colWidths=[175, 175, 173])
    sig_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#94A3B8')),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(sig_table)

    doc.build(story)
    return output_path
