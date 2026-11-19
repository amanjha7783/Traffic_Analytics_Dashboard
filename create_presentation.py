import os
import sys
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.dml.color import RGBColor

# Colors
BG_COLOR = RGBColor(10, 15, 29)         # #0A0F1D Dark Obsidian
CARD_BG = RGBColor(18, 26, 47)          # #121A2F Deep Slate Blue
CARD_BORDER = RGBColor(34, 48, 85)      # #223055
ACCENT_INDIGO = RGBColor(99, 102, 241)  # #6366F1 Electric Indigo
ACCENT_EMERALD = RGBColor(16, 185, 129) # #10B981 Vivid Emerald
ACCENT_AMBER = RGBColor(245, 158, 11)   # #F59E0B Solar Amber
ACCENT_CRIMSON = RGBColor(239, 68, 68)  # #EF4444 Crimson
TEXT_LIGHT = RGBColor(248, 250, 252)    # #F8FAFC
TEXT_MUTED = RGBColor(148, 163, 184)    # #94A3B8
CODE_TEXT = RGBColor(165, 243, 252)     # #A5F3FC

def generate_diagrams():
    os.makedirs("docs", exist_ok=True)
    
    # 1. Architecture Visual Diagram
    fig, ax = plt.subplots(figsize=(12, 6.5), facecolor='#0A0F1D')
    ax.set_facecolor('#0A0F1D')
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')

    # Tier 1: Frontend
    box1 = patches.FancyBboxPatch((0.8, 4.8), 10.4, 1.7, boxstyle="round,pad=0.2", fc='#121A2F', ec='#6366F1', lw=2)
    ax.add_patch(box1)
    ax.text(1.2, 6.1, "TIER 1: PRESENTATION LAYER (React 19 + TypeScript + Vite + Tailwind v4)", color='#6366F1', fontsize=12, fontweight='bold')
    ax.text(1.2, 5.5, "• Dual-Theme Command Center (Cosmic Obsidian & Executive Light)   • 720px Leaflet OSM Vector Map\n• 400px Recharts Synchronized Time-Series Analytics   • HTML5 Calibration Canvas with GCP Drag & Zoom", color='#F8FAFC', fontsize=10)

    # Arrow Down 1
    ax.annotate('', xy=(6.0, 4.2), xytext=(6.0, 4.75), arrowprops=dict(arrowstyle="->", color='#38BDF8', lw=2.5))
    ax.text(6.2, 4.45, "HTTP REST (Port 8000) & WebSockets (/ws/live)", color='#38BDF8', fontsize=9.5, fontweight='bold')

    # Tier 2: Backend
    box2 = patches.FancyBboxPatch((0.8, 2.3), 10.4, 1.8, boxstyle="round,pad=0.2", fc='#121A2F', ec='#10B981', lw=2)
    ax.add_patch(box2)
    ax.text(1.2, 3.7, "TIER 2: APPLICATION & INFERENCE ENGINE (FastAPI Python 3.11+)", color='#10B981', fontsize=12, fontweight='bold')
    ax.text(1.2, 2.8, "• 10 Async REST Routers (/api/route, /api/traffic, /api/video-intelligence, /api/cameras)\n• Vision Pipeline: ONNX Runtime YOLOv8 Detector + ByteTrack Multi-Object Kalman Filter\n• Geometric Math: 4-Point RANSAC Planar Homography   • Background Video Processing Workers", color='#F8FAFC', fontsize=10)

    # Arrow Down 2
    ax.annotate('', xy=(3.0, 1.8), xytext=(3.0, 2.25), arrowprops=dict(arrowstyle="->", color='#F59E0B', lw=2.5))
    ax.annotate('', xy=(6.0, 1.8), xytext=(6.0, 2.25), arrowprops=dict(arrowstyle="->", color='#F59E0B', lw=2.5))
    ax.annotate('', xy=(9.0, 1.8), xytext=(9.0, 2.25), arrowprops=dict(arrowstyle="->", color='#F59E0B', lw=2.5))

    # Tier 3: Data & Models
    box3a = patches.FancyBboxPatch((0.8, 0.4), 3.2, 1.3, boxstyle="round,pad=0.15", fc='#121A2F', ec='#F59E0B', lw=1.5)
    ax.add_patch(box3a)
    ax.text(1.0, 1.3, "SQLite3 Database (WAL)", color='#F59E0B', fontsize=10.5, fontweight='bold')
    ax.text(1.0, 0.7, "• cameras & corridors\n• studio_trajectories\n• minute_aggregates", color='#94A3B8', fontsize=9)

    box3b = patches.FancyBboxPatch((4.4, 0.4), 3.2, 1.3, boxstyle="round,pad=0.15", fc='#121A2F', ec='#F59E0B', lw=1.5)
    ax.add_patch(box3b)
    ax.text(4.6, 1.3, "AI / ML Weight Stores", color='#F59E0B', fontsize=10.5, fontweight='bold')
    ax.text(4.6, 0.7, "• yolov8n.onnx (640x640)\n• XGBoost Regressors\n• 5,768 Row Telemetry", color='#94A3B8', fontsize=9)

    box3c = patches.FancyBboxPatch((8.0, 0.4), 3.2, 1.3, boxstyle="round,pad=0.15", fc='#121A2F', ec='#F59E0B', lw=1.5)
    ax.add_patch(box3c)
    ax.text(8.2, 1.3, "External GIS APIs", color='#F59E0B', fontsize=10.5, fontweight='bold')
    ax.text(8.2, 0.7, "• OpenStreetMap OSRM\n• Nominatim Geocoding\n• GeoJSON Vectors", color='#94A3B8', fontsize=9)

    plt.tight_layout()
    arch_path = "docs/arch_diagram.png"
    plt.savefig(arch_path, dpi=180, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()

    # 2. Workflow Visual Diagram
    fig, ax = plt.subplots(figsize=(12, 6.5), facecolor='#0A0F1D')
    ax.set_facecolor('#0A0F1D')
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')

    stages = [
        ("1. Video Ingest", "Upload MP4/MOV\nExtract Frame #0", (0.5, 4.5), '#6366F1'),
        ("2. Calibration", "4-Point Road GCPs\nRANSAC Homography H", (4.5, 4.5), '#38BDF8'),
        ("3. YOLOv8 ONNX", "Multi-class Detection\nConfidence >= 0.35", (8.5, 4.5), '#10B981'),
        ("4. ByteTrack MOT", "Kalman Prediction\nPersistent Track IDs", (8.5, 1.5), '#F59E0B'),
        ("5. Metric Projection", "H Matrix: Pixels -> Meters\nSpeed = dist / time", (4.5, 1.5), '#EC4899'),
        ("6. Dashboard Studio", "Annotated Video Stream\n4 Recharts Time Series", (0.5, 1.5), '#8B5CF6')
    ]

    for title, desc, (x, y), col in stages:
        box = patches.FancyBboxPatch((x, y), 3.0, 1.8, boxstyle="round,pad=0.15", fc='#121A2F', ec=col, lw=2)
        ax.add_patch(box)
        ax.text(x + 0.2, y + 1.4, title, color=col, fontsize=11.5, fontweight='bold')
        ax.text(x + 0.2, y + 0.5, desc, color='#F8FAFC', fontsize=9.5)

    # Connecting Arrows
    ax.annotate('', xy=(4.4, 5.4), xytext=(3.6, 5.4), arrowprops=dict(arrowstyle="->", color='#F8FAFC', lw=2))
    ax.annotate('', xy=(8.4, 5.4), xytext=(7.6, 5.4), arrowprops=dict(arrowstyle="->", color='#F8FAFC', lw=2))
    ax.annotate('', xy=(10.0, 3.4), xytext=(10.0, 4.4), arrowprops=dict(arrowstyle="->", color='#F8FAFC', lw=2))
    ax.annotate('', xy=(7.6, 2.4), xytext=(8.4, 2.4), arrowprops=dict(arrowstyle="->", color='#F8FAFC', lw=2))
    ax.annotate('', xy=(3.6, 2.4), xytext=(4.4, 2.4), arrowprops=dict(arrowstyle="->", color='#F8FAFC', lw=2))

    plt.tight_layout()
    wf_path = "docs/workflow_diagram.png"
    plt.savefig(wf_path, dpi=180, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()

    print("Diagrams successfully generated in docs/")

def create_presentation(output_path="TrafficOps_Project_Presentation.pptx"):
    generate_diagrams()
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    def add_blank_slide():
        slide = prs.slides.add_slide(blank_layout)
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_COLOR
        bg.line.fill.background()
        return slide

    def add_header(slide, slide_num, category, title, subtitle=None):
        pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.4), Inches(2.8), Inches(0.32))
        pill.fill.solid()
        pill.fill.fore_color.rgb = RGBColor(26, 35, 64)
        pill.line.color.rgb = ACCENT_INDIGO
        pill.line.width = Pt(1)
        tf_pill = pill.text_frame
        tf_pill.word_wrap = True
        tf_pill.vertical_anchor = MSO_ANCHOR.MIDDLE
        p_pill = tf_pill.paragraphs[0]
        p_pill.text = category.upper()
        p_pill.font.size = Pt(9.5)
        p_pill.font.bold = True
        p_pill.font.color.rgb = ACCENT_INDIGO
        p_pill.alignment = PP_ALIGN.CENTER

        num_box = slide.shapes.add_textbox(Inches(11.5), Inches(0.4), Inches(1.2), Inches(0.35))
        tf_num = num_box.text_frame
        p_num = tf_num.paragraphs[0]
        p_num.text = f"SLIDE {slide_num:02d} / 16"
        p_num.font.size = Pt(10)
        p_num.font.bold = True
        p_num.font.color.rgb = TEXT_MUTED
        p_num.alignment = PP_ALIGN.RIGHT

        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.8), Inches(0.65))
        tf_title = title_box.text_frame
        p_title = tf_title.paragraphs[0]
        p_title.text = title
        p_title.font.size = Pt(22)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_LIGHT

        if subtitle:
            p_sub = tf_title.add_paragraph()
            p_sub.text = subtitle
            p_sub.font.size = Pt(11)
            p_sub.font.color.rgb = TEXT_MUTED

        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.5), Inches(11.733), Inches(0.02))
        line.fill.solid()
        line.fill.fore_color.rgb = CARD_BORDER
        line.line.fill.background()

    def add_card(slide, left, top, width, height, title=None, border_color=CARD_BORDER, bg_color=CARD_BG):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        card.line.color.rgb = border_color
        card.line.width = Pt(1.2)
        
        if title:
            tbox = slide.shapes.add_textbox(Inches(left + 0.2), Inches(top + 0.15), Inches(width - 0.4), Inches(0.4))
            tf = tbox.text_frame
            p = tf.paragraphs[0]
            p.text = title
            p.font.size = Pt(13)
            p.font.bold = True
            p.font.color.rgb = TEXT_LIGHT
        return card

    # SLIDE 1: Title
    s1 = add_blank_slide()
    add_card(s1, 1.2, 1.0, 10.933, 5.5, border_color=ACCENT_INDIGO)
    
    tag = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.6), Inches(1.5), Inches(3.6), Inches(0.4))
    tag.fill.solid()
    tag.fill.fore_color.rgb = RGBColor(30, 41, 75)
    tag.line.color.rgb = ACCENT_INDIGO
    tf_tag = tag.text_frame
    p_tag = tf_tag.paragraphs[0]
    p_tag.text = "INTELLIGENT TRANSPORTATION SYSTEM (ITS)"
    p_tag.font.size = Pt(10)
    p_tag.font.bold = True
    p_tag.font.color.rgb = ACCENT_INDIGO
    p_tag.alignment = PP_ALIGN.CENTER

    t_box = s1.shapes.add_textbox(Inches(1.6), Inches(2.1), Inches(10.1), Inches(2.2))
    tf_t = t_box.text_frame
    p1 = tf_t.paragraphs[0]
    p1.text = "TrafficOps: Traffic Intelligence &"
    p1.font.size = Pt(34)
    p1.font.bold = True
    p1.font.color.rgb = TEXT_LIGHT

    p2 = tf_t.add_paragraph()
    p2.text = "Intelligent Route Planning System"
    p2.font.size = Pt(34)
    p2.font.bold = True
    p2.font.color.rgb = ACCENT_INDIGO

    p3 = tf_t.add_paragraph()
    p3.text = "An Enterprise-Grade Command Center Bridging Computer Vision (YOLOv8 + ByteTrack), Planar Homography, OSRM Road Graphs & ML Traffic Forecasting"
    p3.font.size = Pt(13.5)
    p3.font.color.rgb = TEXT_MUTED

    badges = [
        ("FRONTEND", "React 19 + TypeScript + Vite"),
        ("BACKEND", "FastAPI (Python 3.11+ Asynchronous)"),
        ("VISION & ML", "YOLOv8 ONNX, ByteTrack, XGBoost"),
        ("DATABASE & GIS", "SQLite3 (WAL), OSRM, Nominatim")
    ]
    for idx, (b_title, b_val) in enumerate(badges):
        bx = 1.6 + idx * 2.55
        b_card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(bx), Inches(4.7), Inches(2.4), Inches(1.2))
        b_card.fill.solid()
        b_card.fill.fore_color.rgb = RGBColor(14, 21, 38)
        b_card.line.color.rgb = CARD_BORDER
        tf_b = b_card.text_frame
        p_bt = tf_b.paragraphs[0]
        p_bt.text = b_title
        p_bt.font.size = Pt(9.5)
        p_bt.font.bold = True
        p_bt.font.color.rgb = ACCENT_AMBER
        p_bv = tf_b.add_paragraph()
        p_bv.text = b_val
        p_bv.font.size = Pt(11)
        p_bv.font.bold = True
        p_bv.font.color.rgb = TEXT_LIGHT

    # SLIDE 2: Introduction
    s2 = add_blank_slide()
    add_header(s2, 2, "Introduction & Background", "What is TrafficOps?", "Next-generation Smart City Traffic Monitoring & Macro Transportation Engineering")
    add_card(s2, 0.8, 1.7, 5.7, 5.3, "The Real-World Context & Vision", border_color=ACCENT_INDIGO)
    tb2_left = s2.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.3), Inches(4.6))
    tf2_l = tb2_left.text_frame
    tf2_l.word_wrap = True
    bullets_s2_left = [
        ("• Urban Traffic Explosion: ", "Modern metropolises face chronic congestion, resulting in billions of lost work hours, heightened fuel emissions, and delayed emergency response vehicles."),
        ("• The Role of TrafficOps: ", "Acts as an Artificial Intelligence Command Center that converts raw CCTV video streams into actionable traffic telemetry in real time."),
        ("• Dual-Level Perception: ", "Operates simultaneously at the Micro Level (detecting individual vehicles, tracking movement, and computing physical speed) and the Macro Level (network routing and 24-hour congestion forecasting)."),
        ("• Zero Additional Hardware: ", "Uses standard, existing traffic surveillance cameras. Requires no expensive radar poles, magnetic loop detectors, or proprietary IoT sensors.")
    ]
    for b_title, b_desc in bullets_s2_left:
        p = tf2_l.add_paragraph()
        r1 = p.add_run()
        r1.text = b_title
        r1.font.bold = True
        r1.font.size = Pt(12)
        r1.font.color.rgb = ACCENT_INDIGO
        r2 = p.add_run()
        r2.text = b_desc
        r2.font.size = Pt(11.5)
        r2.font.color.rgb = TEXT_LIGHT

    add_card(s2, 6.8, 1.7, 5.7, 5.3, "Core Capabilities at a Glance")
    tb2_right = s2.shapes.add_textbox(Inches(7.0), Inches(2.2), Inches(5.3), Inches(4.6))
    tf2_r = tb2_right.text_frame
    tf2_r.word_wrap = True
    caps = [
        ("1. Real-Time Computer Vision:", "YOLOv8 Neural Network classifies vehicles across 7 categories (Cars, Buses, Trucks, Two-wheelers, Auto-rickshaws, Bicycles, Pedestrians)."),
        ("2. Geometric Planar Homography:", "Mathematical 3x3 projective transformation translates 2D screen pixels directly into physical ground meters and true km/h velocities."),
        ("3. Street-Graph Route Planning:", "Queries OpenStreetMap OSRM road graph to plot exact driving curves and turn maneuvers with congestion delay predictions."),
        ("4. Diurnal Rush-Hour Forecasting:", "XGBoost machine learning model predicts 24-hour travel time curves, identifying morning and evening bottlenecks in advance.")
    ]
    for c_title, c_desc in caps:
        p = tf2_r.add_paragraph()
        r1 = p.add_run()
        r1.text = c_title + "\n"
        r1.font.bold = True
        r1.font.size = Pt(12)
        r1.font.color.rgb = ACCENT_EMERALD
        r2 = p.add_run()
        r2.text = c_desc + "\n"
        r2.font.size = Pt(11)
        r2.font.color.rgb = TEXT_LIGHT

    # SLIDE 3: Problem Statement
    s3 = add_blank_slide()
    add_header(s3, 3, "Problem Statement", "Critical Challenges in Modern Urban Traffic Management", "Why traditional surveillance and static traffic systems are failing cities")
    prob_cards = [
        ("Traditional CCTV Limitations", "High Video Volume, Low Insight", [
            "Thousands of CCTV streams are monitored manually by human operators in control rooms.",
            "Humans cannot manually count vehicles, track trajectories, or calculate average speeds across dozens of simultaneous feeds.",
            "CCTV footage is archived passively and only inspected post-incident rather than generating proactive alerts."
        ], ACCENT_CRIMSON),
        ("Hardware Cost & Complexity", "Prohibitive Sensor Expenses", [
            "Commercial Doppler radar and laser speed detection systems cost over $10,000+ per intersection.",
            "In-pavement inductive loop sensors require tearing up tarmac, causing road closures and high ongoing maintenance costs.",
            "Municipalities in developing nations cannot scale specialized physical sensors across entire arterial networks."
        ], ACCENT_AMBER),
        ("Lack of Predictive Planning", "Reactive Rather Than Proactive", [
            "Fixed-timer traffic lights operate on rigid 60-second intervals regardless of whether 100 or 0 cars are waiting.",
            "Standard consumer navigation apps divert traffic blindly to side streets, creating secondary choke points.",
            "City authorities lack predictive models to forecast morning and evening rush-hour buildup 24 hours in advance."
        ], ACCENT_INDIGO)
    ]
    for idx, (p_title, p_sub, points, p_color) in enumerate(prob_cards):
        cx = 0.8 + idx * 3.95
        add_card(s3, cx, 1.7, 3.8, 5.3, p_title, border_color=p_color)
        tbox = s3.shapes.add_textbox(Inches(cx + 0.15), Inches(2.2), Inches(3.5), Inches(4.6))
        tf = tbox.text_frame
        tf.word_wrap = True
        p_subtitle = tf.paragraphs[0]
        p_subtitle.text = p_sub.upper()
        p_subtitle.font.size = Pt(9.5)
        p_subtitle.font.bold = True
        p_subtitle.font.color.rgb = p_color
        for pt in points:
            p = tf.add_paragraph()
            p.text = "• " + pt
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_LIGHT

    # SLIDE 4: Objectives
    s4 = add_blank_slide()
    add_header(s4, 4, "Project Goals", "Objectives & Scope of TrafficOps", "Targeted outcomes and engineering benchmarks accomplished by the system")
    objs = [
        ("Objective 1: Automated Multi-Class Vehicle Detection", [
            "Implement high-speed deep learning inference using YOLOv8 ONNX.",
            "Accurately recognize 7 distinct vehicle classes under diverse lighting conditions.",
            "Maintain detection confidence >= 0.35 and IoU threshold >= 0.45 without GPU requirement."
        ]),
        ("Objective 2: Metric Ground-Speed Calibration via Homography", [
            "Eliminate optical perspective distortion using 4-point Ground Control Point (GCP) planar homography.",
            "Convert 2D screen coordinates (pixels) to physical ground coordinates (meters).",
            "Calculate vehicle ground speed in km/h with automated reprojection RMSE grading."
        ]),
        ("Objective 3: Intelligent Road-Network Graph Routing", [
            "Integrate OpenStreetMap OSRM and Nominatim for natural language address resolution.",
            "Plot true drivable road vectors eliminating straight-line Euclidean distance approximations.",
            "Evaluate corridor congestion delays to provide traffic-aware alternative routes."
        ]),
        ("Objective 4: Machine Learning Traffic Congestion Forecasting", [
            "Train and deploy an XGBoost regression model on 5,700+ empirical telemetry observations.",
            "Forecast 24-hour travel times, speed degradation, and hourly throughput demand.",
            "Compute the Bureau of Public Roads (BPR) Congestion Index across arterial highway corridors."
        ])
    ]
    for idx, (o_title, o_pts) in enumerate(objs):
        row = idx // 2
        col = idx % 2
        cx = 0.8 + col * 5.95
        cy = 1.7 + row * 2.7
        add_card(s4, cx, cy, 5.8, 2.5, o_title, border_color=ACCENT_INDIGO)
        tbox = s4.shapes.add_textbox(Inches(cx + 0.2), Inches(cy + 0.5), Inches(5.4), Inches(1.9))
        tf = tbox.text_frame
        tf.word_wrap = True
        for pt_idx, pt in enumerate(o_pts):
            p = tf.paragraphs[0] if pt_idx == 0 else tf.add_paragraph()
            p.text = "✔ " + pt
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_LIGHT

    # SLIDE 5: Overview & Features
    s5 = add_blank_slide()
    add_header(s5, 5, "Functional Matrix", "Project Overview & 8 Core Modules", "Comprehensive breakdown of operational capabilities available in the platform")
    modules = [
        ("1. Overview & Dual CV Playback", "Side-by-side video feeds with HTTP 206 byte-range seeking & 7 vehicle taxonomy counters."),
        ("2. Intelligent Route Planner", "720px interactive Leaflet map with OSRM vector routing, Nominatim geocoding & turn-by-turn directions."),
        ("3. 24-Hour Predictive Forecast", "Morning/evening rush hour digests with 24-hr predicted travel time curves powered by XGBoost."),
        ("4. Historical Corridor Analytics", "Interactive corridor filtering across 5,768 records with space-mean speed & BPR Congestion Index."),
        ("5. CCTV Monitor & Hardware Grid", "RTSP camera node registration with server-side MJPEG live streaming and corridor linking."),
        ("6. Virtual Tripwire Line Crossing", "Interactive video canvas allowing users to draw counting lines; tracks directional flow via 2D vector cross product."),
        ("7. Spatial Trajectory Telemetry", "Granular second-by-second vehicle coordinate ingest table with single-click formatted CSV export."),
        ("8. Video Intelligence Studio", "Complete workflow: project creation, video upload, 4-point GCP calibration, background processing & 4-chart analytics.")
    ]
    for idx, (m_title, m_desc) in enumerate(modules):
        row = idx // 4
        col = idx % 4
        cx = 0.8 + col * 2.95
        cy = 1.7 + row * 2.65
        add_card(s5, cx, cy, 2.85, 2.5, m_title, border_color=ACCENT_INDIGO)
        tbox = s5.shapes.add_textbox(Inches(cx + 0.15), Inches(cy + 0.55), Inches(2.55), Inches(1.8))
        tf = tbox.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = m_desc
        p.font.size = Pt(10.5)
        p.font.color.rgb = TEXT_LIGHT

    # SLIDE 6: System Architecture (WITH EMBEDDED DIAGRAM)
    s6 = add_blank_slide()
    add_header(s6, 6, "Architecture Visual", "System Architecture & 3-Tier Layering", "Coupling React 19, Asynchronous FastAPI, ONNX Runtime, and SQLite Database")
    if os.path.exists("docs/arch_diagram.png"):
        s6.shapes.add_picture("docs/arch_diagram.png", Inches(0.8), Inches(1.7), width=Inches(11.733), height=Inches(5.3))

    # SLIDE 7: Complete Workflow (WITH EMBEDDED FLOWCHART)
    s7 = add_blank_slide()
    add_header(s7, 7, "Workflow & Lifecycle", "Complete End-to-End Application Workflow", "The 6-stage operational pipeline from raw CCTV video ingestion to real-time analytics")
    if os.path.exists("docs/workflow_diagram.png"):
        s7.shapes.add_picture("docs/workflow_diagram.png", Inches(0.8), Inches(1.7), width=Inches(11.733), height=Inches(5.3))

    # SLIDE 8: Frontend Architecture
    s8 = add_blank_slide()
    add_header(s8, 8, "Frontend Architecture", "React 19 + TypeScript + Vite Structure", "Component hierarchy, type safety, state management, and services abstraction")
    add_card(s8, 0.8, 1.7, 5.7, 5.3, "Component Hierarchy & State Flow", border_color=ACCENT_INDIGO)
    tb8_l = s8.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.3), Inches(4.6))
    tf8_l = tb8_l.text_frame
    tf8_l.word_wrap = True
    f_arch_pts = [
        ("• main.tsx (DOM Mount): ", "Boots React 19 inside <BrowserRouter> to enable smooth Single Page Application (SPA) routing without page reloads."),
        ("• App.tsx (Master Layout): ", "Manages global navigation, persistent sidebar state (localStorage), and binds 10 URL route paths to page components."),
        ("• Component Isolation: ", "Reusable UI widgets (Header, Sidebar, KpiRow, VideoPlayerFeed, ReportsView) separated cleanly from full page views."),
        ("• TypeScript Strict Typing: ", "Comprehensive interfaces in types.ts (VehicleClass, TrajectoryPoint, CorridorMetrics, CameraNode) guarantee zero runtime property errors."),
        ("• Tailwind CSS v4 Styling: ", "Theme-driven utility classes with dark/light mode toggle and responsive flex/grid layouts.")
    ]
    for b_title, b_desc in f_arch_pts:
        p = tf8_l.add_paragraph()
        r1 = p.add_run()
        r1.text = b_title
        r1.font.bold = True
        r1.font.size = Pt(11.5)
        r1.font.color.rgb = ACCENT_INDIGO
        r2 = p.add_run()
        r2.text = b_desc
        r2.font.size = Pt(11)
        r2.font.color.rgb = TEXT_LIGHT

    add_card(s8, 6.8, 1.7, 5.7, 5.3, "Services Layer (Axios HTTP Client)")
    tb8_r = s8.shapes.add_textbox(Inches(7.0), Inches(2.2), Inches(5.3), Inches(4.6))
    tf8_r = tb8_r.text_frame
    tf8_r.word_wrap = True
    srv_pts = [
        ("api.js", "Core telemetry client fetching KPI summaries, vehicle volume distributions, and historical CSV trajectories."),
        ("routeApi.ts", "Queries Nominatim for place search and OSRM for candidate road graphs with full TypeScript type validation."),
        ("trafficApi.ts", "Communicates with /api/traffic to retrieve 24-hour diurnal rush profiles and XGBoost predicted travel times."),
        ("videoApi.ts", "Controls CCTV node streams, RTSP configuration, and line-crossing virtual tripwires."),
        ("videoIntelligenceApi.ts", "Manages the multi-step studio: project creation, video uploading, homography calibration submission, and job polling.")
    ]
    for s_file, s_detail in srv_pts:
        p = tf8_r.add_paragraph()
        r1 = p.add_run()
        r1.text = "• " + s_file + "\n"
        r1.font.bold = True
        r1.font.size = Pt(11.5)
        r1.font.color.rgb = ACCENT_EMERALD
        r2 = p.add_run()
        r2.text = s_detail + "\n"
        r2.font.size = Pt(10.5)
        r2.font.color.rgb = TEXT_LIGHT

    # SLIDE 9: Frontend Features & UI (WITH EMBEDDED PROJECT FOOTAGE)
    s9 = add_blank_slide()
    add_header(s9, 9, "User Interface & Experience", "Frontend UI Showcase & Interactive Modules", "Visual highlights of the major operational interfaces across the platform")
    
    # Left side: 3 cards
    ui_left_pts = [
        ("Dual-Feed CV Player", "Side-by-side video feeds with automated bounding boxes, byte-range seeking, and 7-class vehicle taxonomy counters."),
        ("720px Leaflet Route Map", "Rendered on clean OSM vector tiles with 8px electric-indigo route polyline and turn-by-turn navigation list."),
        ("Synchronized Analytics", "Full HTML5 video player synchronized with 4 Recharts graphs and trajectory inspection table.")
    ]
    for idx, (u_title, u_desc) in enumerate(ui_left_pts):
        cy = 1.7 + idx * 1.75
        add_card(s9, 0.8, cy, 5.5, 1.6, u_title, border_color=ACCENT_INDIGO)
        tb = s9.shapes.add_textbox(Inches(1.0), Inches(cy + 0.45), Inches(5.1), Inches(1.1))
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = u_desc
        p.font.size = Pt(11)
        p.font.color.rgb = TEXT_LIGHT

    # Right side: Frame image from project
    img_path = "backend/data/studio/projects/proj-c54b8e94/videos/vid-4f02fc7a06/first_frame.jpg"
    add_card(s9, 6.6, 1.7, 5.933, 5.3, "Actual CCTV Video Ingest (Calibration Studio)", border_color=ACCENT_EMERALD)
    if os.path.exists(img_path):
        s9.shapes.add_picture(img_path, Inches(6.8), Inches(2.2), width=Inches(5.533), height=Inches(3.3))
        cap_box = s9.shapes.add_textbox(Inches(6.8), Inches(5.6), Inches(5.533), Inches(1.2))
        tf_c = cap_box.text_frame
        tf_c.word_wrap = True
        p_c1 = tf_c.paragraphs[0]
        p_c1.text = "Frame #0 Extracted via OpenCV VideoCapture"
        p_c1.font.size = Pt(11)
        p_c1.font.bold = True
        p_c1.font.color.rgb = ACCENT_AMBER
        p_c2 = tf_c.add_paragraph()
        p_c2.text = "4-Point Ground Control Points (GCPs) are placed directly onto road intersections on this canvas to compute RANSAC Planar Homography."
        p_c2.font.size = Pt(10)
        p_c2.font.color.rgb = TEXT_LIGHT

    # SLIDE 10: Backend Architecture
    s10 = add_blank_slide()
    add_header(s10, 10, "Backend Architecture", "FastAPI Python Backend & Modular Design", "High-concurrency asynchronous server architecture and services abstraction")
    add_card(s10, 0.8, 1.7, 5.7, 5.3, "FastAPI Application Framework", border_color=ACCENT_INDIGO)
    tb10_l = s10.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.3), Inches(4.6))
    tf10_l = tb10_l.text_frame
    tf10_l.word_wrap = True
    b_arch_pts = [
        ("• Asynchronous Execution (async/await): ", "Non-blocking event loop handles hundreds of concurrent REST queries and WebSockets without freezing during video processing."),
        ("• Modular Router Architecture: ", "Clean separation of responsibilities into 10 distinct API routers (/api/route, /api/traffic, /api/video-intelligence, etc.)."),
        ("• Automated Pydantic Validation: ", "Request and response schemas in schemas.py perform automatic data type checking and validation before business logic executes."),
        ("• Dynamic CORS Middleware: ", "Enables secure cross-origin communication between React (port 5173) and FastAPI (port 8000)."),
        ("• Lifespan Startup Management: ", "Modern FastAPI lifespan context manager initializes SQLite database tables on boot.")
    ]
    for b_title, b_desc in b_arch_pts:
        p = tf10_l.add_paragraph()
        r1 = p.add_run()
        r1.text = b_title
        r1.font.bold = True
        r1.font.size = Pt(11.5)
        r1.font.color.rgb = ACCENT_INDIGO
        r2 = p.add_run()
        r2.text = b_desc
        r2.font.size = Pt(11)
        r2.font.color.rgb = TEXT_LIGHT

    add_card(s10, 6.8, 1.7, 5.7, 5.3, "Actual Code: main.py Router Registration")
    tb10_r = s10.shapes.add_textbox(Inches(7.0), Inches(2.2), Inches(5.3), Inches(4.6))
    tf10_r = tb10_r.text_frame
    tf10_r.word_wrap = True
    p_code = tf10_r.paragraphs[0]
    p_code.text = "# backend/app/main.py\n"
    p_code.font.size = Pt(10)
    p_code.font.bold = True
    p_code.font.color.rgb = ACCENT_AMBER
    code_lines = [
        "app.include_router(health.router, prefix='/api')",
        "app.include_router(trajectories.router, prefix='/api/trajectories')",
        "app.include_router(analytics.router, prefix='/api/analytics')",
        "app.include_router(route_planner.router, prefix='/api/route')",
        "app.include_router(traffic_forecast.router, prefix='/api/traffic')",
        "app.include_router(cameras.router, prefix='/api/cameras')",
        "app.include_router(corridors.router, prefix='/api/corridors')",
        "app.include_router(video_processing.router, prefix='/api/video-processing')",
        "app.include_router(websockets.router, prefix='/api/ws')",
        "app.include_router(video_intelligence.router, prefix='/api/video-intelligence')"
    ]
    for cl in code_lines:
        p = tf10_r.add_paragraph()
        p.text = cl
        p.font.size = Pt(9.5)
        p.font.color.rgb = CODE_TEXT

    # SLIDE 11: Backend Functionality & Computer Vision
    s11 = add_blank_slide()
    add_header(s11, 11, "Computer Vision & Mathematics", "Vision Inference, Tracking & Planar Homography", "The scientific pipeline converting distorted 2D camera pixels into true physical velocities")
    cv_stages = [
        ("Stage 1: YOLOv8 ONNX Object Detection", [
            "Runs lightweight yolov8n.onnx neural network via ONNX Runtime.",
            "Preprocesses 1080p frames into 640x640 normalized tensors.",
            "Applies Non-Maximum Suppression (NMS) to eliminate duplicate bounding boxes.",
            "Extracts confidence scores and 7 vehicle class categories."
        ]),
        ("Stage 2: ByteTrack Multi-Object Tracking", [
            "Solves temporal identity association across consecutive frames.",
            "Uses a Kalman Filter to predict vehicle bounding box locations.",
            "Calculates Intersection-over-Union (IoU) distance matrix.",
            "Maintains consistent Track IDs (e.g. Car #42) across video sequence."
        ]),
        ("Stage 3: 4-Point Planar Homography Matrix", [
            "Solves 3x3 projective transformation matrix H using cv2.findHomography.",
            "RANSAC algorithm discards user clicking inaccuracies and outliers.",
            "Maps vehicle bottom-center pixel (u, v) into physical ground meters (X, Y).",
            "Calculates true space-mean speed: v = distance / time (km/h)."
        ])
    ]
    for idx, (st_title, st_pts) in enumerate(cv_stages):
        cx = 0.8 + idx * 3.95
        add_card(s11, cx, 1.7, 3.8, 5.3, st_title, border_color=ACCENT_INDIGO)
        tbox = s11.shapes.add_textbox(Inches(cx + 0.15), Inches(2.2), Inches(3.5), Inches(4.6))
        tf = tbox.text_frame
        tf.word_wrap = True
        for pt_idx, pt in enumerate(st_pts):
            p = tf.paragraphs[0] if pt_idx == 0 else tf.add_paragraph()
            p.text = "• " + pt
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_LIGHT

    # SLIDE 12: Database Design
    s12 = add_blank_slide()
    add_header(s12, 12, "Database Design", "Relational Database Schema & Telemetry Tables", "Thread-safe SQLite3 architecture with WAL mode and normalized relational schemas")
    tables = [
        ("cameras", "CCTV Node Registry", [
            "id (TEXT, PK): Unique camera identifier",
            "name, junction, code: Node metadata",
            "rtsp_url, video_source: Video stream link",
            "latitude, longitude: GPS coordinate location",
            "status: ONLINE vs. OFFLINE indicator"
        ]),
        ("traffic_corridors", "Two-Camera Arterial Links", [
            "id (TEXT, PK): Unique corridor code",
            "camera_a_id (FK), camera_b_id (FK): Linked nodes",
            "road_length_m, road_width_m: Geometry dimensions",
            "speed_limit_kmh: Regulatory corridor velocity",
            "geometry_geojson: OSM coordinate path"
        ]),
        ("minute_traffic_aggregates", "Pre-Computed Macro Metrics", [
            "id (TEXT, PK), timestamp, corridor_id",
            "total_unique_vehicles, vph throughput",
            "average_speed_kmh: Space-mean speed",
            "traffic_density_vpkm: Density per km",
            "congestion_index: BPR Delay Ratio"
        ]),
        ("studio_video_trajectories", "Granular Telemetry Stream", [
            "id (TEXT, PK), video_id (FK), track_id",
            "timestamp: Millisecond video offset",
            "image_x, image_y: Screen pixel coordinates",
            "ground_x_m, ground_y_m: Real physical meters",
            "speed_kmh: Calibrated vehicle velocity"
        ])
    ]
    for idx, (tbl_name, tbl_desc, tbl_cols) in enumerate(tables):
        row = idx // 2
        col = idx % 2
        cx = 0.8 + col * 5.95
        cy = 1.7 + row * 2.7
        add_card(s12, cx, cy, 5.8, 2.5, f"TABLE: {tbl_name}", border_color=ACCENT_INDIGO)
        tbox = s12.shapes.add_textbox(Inches(cx + 0.2), Inches(cy + 0.45), Inches(5.4), Inches(1.95))
        tf = tbox.text_frame
        tf.word_wrap = True
        p_sub = tf.paragraphs[0]
        p_sub.text = tbl_desc.upper()
        p_sub.font.size = Pt(9.5)
        p_sub.font.bold = True
        p_sub.font.color.rgb = ACCENT_AMBER
        for col_def in tbl_cols:
            p = tf.add_paragraph()
            p.text = "• " + col_def
            p.font.size = Pt(10.5)
            p.font.color.rgb = TEXT_LIGHT

    # SLIDE 13: API Integration
    s13 = add_blank_slide()
    add_header(s13, 13, "API Integration", "API Endpoints & Inter-Module Communication", "Comprehensive RESTful API inventory, WebSocket feeds, and third-party integrations")
    api_groups = [
        ("Route & Geocoding Endpoints", [
            "GET  /api/route/geocode?q={name} - Resolves landmarks to GPS via Nominatim.",
            "POST /api/route/plan - Queries OSRM graph for turn-by-turn driving candidates.",
            "Input: Origin & Destination [lat, lon]; Output: Distance (km), duration (min), GeoJSON polyline."
        ]),
        ("Traffic Telemetry & Forecasting", [
            "GET  /api/traffic/corridors - Lists 8 monitored Lucknow highway corridors.",
            "GET  /api/traffic/forecast/{corridor_id} - Delivers 24-hr rush-hour curves & XGBoost predictions.",
            "GET  /api/analytics/kpis - Returns space-mean velocity and total vehicle counts."
        ]),
        ("Video Intelligence Studio APIs", [
            "POST /api/video-intelligence/projects - Creates isolated project workspace.",
            "POST /api/video-intelligence/projects/{id}/videos - Video upload & Frame #0 extraction.",
            "POST /api/video-intelligence/videos/{id}/calibration - Submits 4-point GCPs & starts job.",
            "GET  /api/video-intelligence/jobs/{job_id}/progress - Real-time polling (progress %, FPS, ETA)."
        ]),
        ("Live Video & WebSocket Streaming", [
            "GET  /api/cameras/{id}/stream - Multi-part MJPEG live video stream.",
            "WS   /api/ws/live - Full-duplex persistent WebSocket pushing vehicle detections.",
            "POST /api/video-processing/process - Runs virtual tripwire line-crossing counting."
        ])
    ]
    for idx, (grp_title, grp_apis) in enumerate(api_groups):
        row = idx // 2
        col = idx % 2
        cx = 0.8 + col * 5.95
        cy = 1.7 + row * 2.7
        add_card(s13, cx, cy, 5.8, 2.5, grp_title, border_color=ACCENT_INDIGO)
        tbox = s13.shapes.add_textbox(Inches(cx + 0.2), Inches(cy + 0.5), Inches(5.4), Inches(1.9))
        tf = tbox.text_frame
        tf.word_wrap = True
        for api_idx, api_str in enumerate(grp_apis):
            p = tf.paragraphs[0] if api_idx == 0 else tf.add_paragraph()
            p.text = "• " + api_str
            p.font.size = Pt(10.5)
            p.font.color.rgb = TEXT_LIGHT

    # SLIDE 14: Technologies & Tools
    s14 = add_blank_slide()
    add_header(s14, 14, "Technology Stack", "Technologies, Frameworks & Libraries", "Enterprise-grade open source tooling selected for high performance and zero licensing fees")
    tech_matrix = [
        ("React 19 & TypeScript", "Frontend Framework", "Component-based architecture, hooks (useState, useEffect), and strict static typing preventing runtime bugs."),
        ("Vite 8 & Tailwind CSS v4", "Build Tool & Styling", "Lightning-fast Hot Module Replacement (HMR) and utility-first responsive Dark Obsidian design system."),
        ("Leaflet & React-Leaflet", "Interactive Maps", "Renders true OpenStreetMap vector tiles, custom 40px SVG pins, and GeoJSON route polylines without paid API keys."),
        ("FastAPI & Uvicorn", "Backend Engine", "Asynchronous Python framework with native Pydantic data validation and auto-generated OpenAPI Swagger docs."),
        ("OpenCV & ONNX Runtime", "Computer Vision", "Hardware-accelerated C++ inference execution for YOLOv8 neural network and video frame manipulation."),
        ("NumPy, Shapely, NetworkX", "Mathematics & GIS", "Matrix computations for Planar Homography, polygon intersection for road density, and graph routing."),
        ("XGBoost & Scikit-Learn", "Machine Learning", "Gradient-boosted decision trees trained on empirical telemetry to forecast travel time and congestion delays."),
        ("OSRM & Nominatim", "External GIS Engines", "Open-source road routing machine and geocoding services powering true street turn-by-turn navigation.")
    ]
    for idx, (t_name, t_cat, t_why) in enumerate(tech_matrix):
        row = idx // 4
        col = idx % 4
        cx = 0.8 + col * 2.95
        cy = 1.7 + row * 2.65
        add_card(s14, cx, cy, 2.85, 2.5, t_name, border_color=ACCENT_INDIGO)
        tbox = s14.shapes.add_textbox(Inches(cx + 0.15), Inches(cy + 0.5), Inches(2.55), Inches(1.9))
        tf = tbox.text_frame
        tf.word_wrap = True
        p_c = tf.paragraphs[0]
        p_c.text = t_cat.upper()
        p_c.font.size = Pt(9)
        p_c.font.bold = True
        p_c.font.color.rgb = ACCENT_EMERALD
        p_w = tf.add_paragraph()
        p_w.text = t_why
        p_w.font.size = Pt(10)
        p_w.font.color.rgb = TEXT_LIGHT

    # SLIDE 15: Advantages & Future
    s15 = add_blank_slide()
    add_header(s15, 15, "Evaluation & Future", "Advantages, Current Limitations & Future Roadmap", "Honest engineering appraisal and pathways for commercial smart-city deployment")
    eval_cards = [
        ("Key System Advantages", ACCENT_EMERALD, [
            "✔ 100% Software-Based: Zero need for expensive radar or pavement loop sensors.",
            "✔ High Processing Speed: ONNX Runtime achieves 25-30 FPS on standard laptop CPUs.",
            "✔ Metric Accuracy: 4-point RANSAC Homography guarantees real-world speed calibration in km/h.",
            "✔ Zero Paid API Dependencies: Built entirely on open-source OSRM, Nominatim, and Leaflet."
        ]),
        ("Current Limitations", ACCENT_AMBER, [
            "⚠ Extreme Weather: Heavy monsoon rain, fog, or night glares can reduce YOLO detection confidence.",
            "⚠ Occlusion: Tall buses or trucks can temporarily hide two-wheelers in high-density bottlenecks.",
            "⚠ Fixed Camera Assumption: Planar homography assumes camera is stationary; wind shake requires re-stabilization."
        ]),
        ("Future Research Scope", ACCENT_INDIGO, [
            "🚀 Edge AI Deployment: Porting pipeline to NVIDIA Jetson Orin microcomputers directly on camera poles.",
            "🚀 Automatic Homography: Deep learning-based automatic vanishing point and lane detection.",
            "🚀 Adaptive Traffic Signals: Integrating real-time queue density directly with physical signal controllers."
        ])
    ]
    for idx, (e_title, e_color, e_pts) in enumerate(eval_cards):
        cx = 0.8 + idx * 3.95
        add_card(s15, cx, 1.7, 3.8, 5.3, e_title, border_color=e_color)
        tbox = s15.shapes.add_textbox(Inches(cx + 0.15), Inches(2.2), Inches(3.5), Inches(4.6))
        tf = tbox.text_frame
        tf.word_wrap = True
        for pt_idx, pt in enumerate(e_pts):
            p = tf.paragraphs[0] if pt_idx == 0 else tf.add_paragraph()
            p.text = pt + "\n"
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_LIGHT

    # SLIDE 16: Conclusion & Viva
    s16 = add_blank_slide()
    add_header(s16, 16, "Conclusion & Defense", "Project Conclusion & Technical Viva Summary", "Final takeaway summary and readiness for technical evaluation")
    add_card(s16, 0.8, 1.7, 5.7, 5.3, "Key Achievements & Takeaways", border_color=ACCENT_INDIGO)
    tb16_l = s16.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.3), Inches(4.6))
    tf16_l = tb16_l.text_frame
    tf16_l.word_wrap = True
    conc_pts = [
        ("• Successfully Engineered: ", "A complete, production-grade Intelligent Transportation System uniting Computer Vision, Planar Geometry, and Machine Learning."),
        ("• Verified Performance: ", "Processes 1080p video at real-time speeds, tracking unique vehicle paths and computing metric speeds with validated reprojection error."),
        ("• Turnkey Usability: ", "From raw video upload and drag-and-drop calibration to interactive OSRM routing and BPR congestion indices, every module is fully functional."),
        ("• Industry Relevance: ", "Directly applicable to municipal traffic command centers, smart city consulting audits, and automated highway tolling systems.")
    ]
    for b_title, b_desc in conc_pts:
        p = tf16_l.add_paragraph()
        r1 = p.add_run()
        r1.text = b_title
        r1.font.bold = True
        r1.font.size = Pt(12)
        r1.font.color.rgb = ACCENT_INDIGO
        r2 = p.add_run()
        r2.text = b_desc
        r2.font.size = Pt(11.5)
        r2.font.color.rgb = TEXT_LIGHT

    add_card(s16, 6.8, 1.7, 5.7, 5.3, "Viva / Technical Interview Ready", border_color=ACCENT_EMERALD)
    tb16_r = s16.shapes.add_textbox(Inches(7.0), Inches(2.2), Inches(5.3), Inches(4.6))
    tf16_r = tb16_r.text_frame
    tf16_r.word_wrap = True
    viva_pts = [
        ("Why Homography? ", "Solves the optical perspective distortion problem; turns 2D pixel coordinates into real-world meters."),
        ("Why ByteTrack? ", "Maintains vehicle identity across frames using Kalman filter and IoU distance; prevents counting the same car 150 times."),
        ("Why ONNX Runtime? ", "Lightweight, cross-platform C++ execution engine that avoids 5GB PyTorch overhead."),
        ("Why OSRM? ", "True road-network graph routing respecting one-ways and turn maneuvers instead of straight-line distance.")
    ]
    for q_t, q_ans in viva_pts:
        p = tf16_r.add_paragraph()
        r1 = p.add_run()
        r1.text = "Q: " + q_t + "\n"
        r1.font.bold = True
        r1.font.size = Pt(11.5)
        r1.font.color.rgb = ACCENT_AMBER
        r2 = p.add_run()
        r2.text = "A: " + q_ans + "\n"
        r2.font.size = Pt(11)
        r2.font.color.rgb = TEXT_LIGHT

    p_qa = tf16_r.add_paragraph()
    p_qa.text = "\nThank You! Open for Questions & Technical Discussion."
    p_qa.font.size = Pt(12)
    p_qa.font.bold = True
    p_qa.font.color.rgb = ACCENT_EMERALD
    p_qa.alignment = PP_ALIGN.CENTER

    prs.save(output_path)
    print(f"Successfully generated 16-slide presentation at: {output_path}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "TrafficOps_Project_Presentation.pptx"
    create_presentation(out_file)
