# Traffic Intelligence & Intelligent Route Planning System (TrafficOps)

An enterprise-grade, full-stack intelligent transportation engineering platform and operations command center. The system combines real-time computer vision traffic monitoring, vehicle trajectory analysis, OpenStreetMap road-network routing, historical telemetry analytics, and Machine Learning-based travel time prediction into a unified dashboard.

---

## 1. Executive Summary & Architecture Overview

TrafficOps bridges real-time sensory perception (computer vision and video inference) with macro-level transportation planning (graph-based routing and predictive travel-time modeling). 

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        React 19 + TypeScript + Vite Frontend                           │
│  - Dual-Theme Command Center UI (Cosmic Obsidian & Executive Light)                    │
│  - Universal Collapsible Sidebar Navigation with LocalStorage Persistence              │
│  - 8 Primary Intelligence Modules (Overview, Route, Forecast, History, Monitor, etc.) │
│  - 720px Interactive Leaflet Map with Real OSM Vectors & Custom 40px Pins              │
│  - 380px–420px Recharts Visualizations with Gradient Illumination & Dark Tooltips      │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP REST & Byte-Range Video Streams (Port 8000)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                FastAPI Python Backend                                  │
│  ├── /api/route/*            OSRM Road-Graph & Nominatim Geocoding Engine              │
│  ├── /api/traffic/*          Diurnal Profiles, Congestion Indices & ML Forecasts       │
│  ├── /api/trajectories/*     Spatial 2D Pixel Coordinate Tracking Telemetry            │
│  ├── /api/analytics/*        Network KPIs & Historical Time-Series Aggregations        │
│  ├── /api/cameras/*          CCTV RTSP Node Lifecycle & MJPEG Stream Pipelines         │
│  ├── /api/corridors/*        Two-Camera Corridors & 4-Point Homography Calibration     │
│  └── /api/video-processing/* Offline YOLOv8 Inferences, Line-Crossing, & Audit Exports │
└─────────────┬─────────────────────┬────────────────────┬───────────────────┬───────────┘
              │                     │                    │                   │
              ▼                     ▼                    ▼                   ▼
     Nominatim / Photon          OSRM API        XGBoost Regressor     YOLOv8 ONNX
    (Geocoding Engine)      (Road Graph Engine)  (Travel-Time Model) (Vision Detector)
```

---

## 2. Complete Inventory of System Features & Modules

The platform is structured into **8 core intelligence modules**, accessible via the universal navigation sidebar:

### 2.1 Overview & Dual-Feed CV Playback (`/` & `VideoPlayerFeed.tsx`)
* **Dual Video Inference Players:** Side-by-side video feeds displaying processed intersection video footage with automated bounding box annotations.
* **HTTP Byte-Range Seeking:** Video streaming router supports partial content requests (HTTP 206) for responsive seeking.
* **Object Taxonomy Classification Counters:** Real-time counters displaying detected quantities across 7 categories:
  * Two-wheelers (Motorcycles, Scooters)
  * Three-wheelers (Auto-rickshaws)
  * Four-wheelers / Cars
  * Transit Buses
  * Heavy Commercial Trucks
  * Bicycles
  * Pedestrians (tracked independently)
* **Video Metadata Badges:** Displays video duration, frame dimensions ($W \times H$), file size (MB), and source processing Job IDs.
* **Stream Refresh & Quick Access:** Direct link to live camera stream configuration in the Traffic Monitor.

### 2.2 Intelligent Multi-Modal Route Planner (`RoutePlanner.tsx`)
* **Dual Geocoding Engine:** Resolves natural language addresses and landmarks using OpenStreetMap Nominatim and Photon search, supplemented by a pre-cached regional landmark database for instant resolution without network delay.
* **True Road-Network Topology:** Eliminates straight-line approximations; queries the OpenStreetMap OSRM routing engine to retrieve exact road vectors, elevation curves, and driving instructions.
* **Interactive 720px Leaflet Map:**
  * Rendered on clean OpenStreetMap vector tiles.
  * 8px thick primary route polyline with electric indigo glow.
  * Custom 40px high-contrast SVG map pins (Emerald for Origin "A", Crimson for Destination "B").
  * Automatic map viewport bounding box fitting (`MapBoundsUpdater`).
* **Multi-Route Candidate Comparison:** Generates primary and alternative candidate routes with distance (km) and estimated duration (minutes).
* **Collapsible Turn-by-Turn Navigation:** Step-by-step maneuver instructions with localized distances (meters/kilometers) and directional arrows.
* **Routing Objectives:**
  * *Mode A (Baseline):* Shortest physical road distance using network topology.
  * *Mode B (Traffic-Aware):* Evaluates corridor travel-time estimates and historical congestion delays.

### 2.3 24-Hour Predictive Traffic Forecast (`TrafficForecast.tsx`)
* **Diurnal Rush Hour Digest:** Three high-visibility operational cards analyzing:
  * **Morning Rush (07:00 – 11:00):** Inflow commuter volume and velocity.
  * **Afternoon Inter-Peak (12:00 – 16:00):** Mid-day baseline velocity and flow.
  * **Evening Rush (17:00 – 21:00):** Dispersal outflow volume and speed degradation.
* **24-Hour Predicted Travel Time Curve (400px Chart):** Continuous hourly trajectory showing expected travel time in seconds, with highlighted amber and crimson reference areas denoting peak congestion intervals.
* **Predicted Velocity Profile (380px Chart):** Line chart benchmarked against the corridor's regulatory speed limit.
* **Anticipated Hourly Throughput Demand (380px Chart):** Hourly volume bar chart in vehicles per hour (veh/h).
* **ML Model Telemetry Card:** Inspects the active prediction engine:
  * Model architecture identification.
  * Test Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE) on chronological hold-out splits.
  * Number of training sample observations.
  * Feature extraction list (hour, day of week, peak flag, road length, lanes, volume).

### 2.4 Historical Traffic Analytics (`HistoricalAnalytics.tsx`)
* **Interactive Filter Toolbar:** Filter analytics by monitored corridor, diurnal period (All, Morning, Afternoon, Evening), and custom start/end date ranges with instant reset.
* **Four High-Impact Metric Cards:**
  * Total Dataset Observations ($5,768+$ records across 8 Lucknow arterial corridors).
  * Network-wide Space-Mean Speed (km/h) and average segment traversal time.
  * Peak Congestion Hour identification.
  * Busiest Road Segment with average hourly flow.
* **Four 380px Analytical Charts:**
  1. **Hourly Volume Distribution:** 24-hour bar chart detailing hourly flow profiles.
  2. **Average Speed Curves:** Monotone line curve capturing speed drops during morning and evening rush hours.
  3. **Weekday vs. Weekend Grouped Comparison:** Dual-axis bar chart comparing traffic volume (veh/h) against velocity (km/h) across working and weekend days.
  4. **Daily Congestion Index Trend:** Time-series line chart tracking the Bureau of Public Roads (BPR) Congestion Index ($\text{Index} = \text{Free-Flow Speed} / \text{Observed Speed}$).
* **Automated Peak Congestion Window Detection:** Threshold detection algorithm surfacing active morning and evening rush windows with discrete 60-minute interval breakdown tables.

### 2.5 Camera Streams & Vision Ingest Monitor (`TrafficMonitorDashboard.tsx`)
* **Configured CCTV Endpoint Cards:**
  * Live server-side MJPEG video stream rendering.
  * Real-time connection indicators (Online vs. Offline).
  * Direct Start Stream / Stop Stream controls.
  * Active metadata: RTSP source status, credentials state, unique track counts.
* **Camera Node Registration Form:** Form to register camera sources with ID, name, junction, internal code, protocol (RTSP, Local File, or Webcam), GPS coordinates, and compass direction.
* **Two-Camera Highway Corridor Linking:** Pairs upstream and downstream camera nodes, calculating total road length and geometry via OSRM.
* **4-Point Ground-Plane Homography Calibration:** Matrix calculation tool accepting paired 2D pixel coordinates ($x, y$) and physical ground coordinates (meters) to compute planar reprojection scale (Reprojection RMSE).
* **Offline Recorded Video Processing Console:**
  * Video file uploader (`.mp4`, `.mov`, `.avi`, `.mkv`).
  * Interactive video viewport for establishing a **virtual tripwire counting line** by clicking two points.
  * Detector confidence threshold slider ($0.05$ to $0.95$).
  * Execution controls: Start Processing, Pause, Resume, Stop.
  * Live telemetry progress bar with frame-by-frame counts, raw detections, confirmed unique tracks, and line-crossing counts.

### 2.6 Spatial Trajectory Telemetry (`TrajectoriesSection.tsx`)
* **Chronological Ingest Table:** High-density spatial coordinate viewer displaying tracked vehicle IDs, taxonomy classes, source timestamps, X/Y screen coordinates, and pixel velocities.
* **Category Filtering:** Filter trajectory logs by vehicle class or display all records.
* **CSV Telemetry Export:** Single-click export button downloading all visible trajectory observations into a formatted CSV file (`trajectory_file_records.csv`).
* **Row Selection:** Click any row to inspect individual vehicle movement vectors.

### 2.7 Telemetry KPIs & Core Health (`AnalyticsCharts.tsx` & `KpiRow.tsx`)
* **Prominent Metric Cards:**
  * **Total Vehicles Tracked:** High-contrast `text-6xl font-black` numerical display with verified repository provenance.
  * **Average Correlative Speed:** Space-mean velocity in km/h derived from trajectory logs.
* **Trajectory Area Timeline (400px):** Area chart showing instantaneous vehicle track counts over time with electric indigo gradient fill.
* **Sensor Capability Status Cards:** Clear indicators detailing status of vehicle classification mix, physical ground velocity calibration, and spatial conflict (Time-to-Collision / TTC) analysis.

### 2.8 Traffic Audit & Reports Hub (`ReportsView.tsx`)
* **Audited Video Inference Exports:** Central repository linking completed vision processing runs to downloadable file artifacts:
  * **Category Count Summary (CSV):** Aggregated vehicle counts sorted by class.
  * **Confirmed Track Details (CSV):** Frame-by-frame coordinate logs and tracking IDs.
  * **Minute-wise Traffic Counts (CSV):** 60-second time-interval throughput histogram.
  * **Processing Telemetry Summary (JSON):** Model confidence, frame rates, hardware execution parameters.
  * **Annotated Video Footage (MP4):** Full-resolution video recording with bounding box overlays.

### 2.9 Video Intelligence Workflow (`/video-intelligence`)
A complete, streamlined video intelligence workflow backed by real computer vision, geospatial planar homography, and transportation analytics. Every screen has a dedicated, bookmarkable URL:

1. **Project Listing (`/video-intelligence`):**
   * Displays all active traffic analysis projects with metadata (project name, description, creation date, open button).
   * Prominent **Create New Project** action opening a modal requiring only **Project Name** and optional **Description**.
2. **Project Workspace (`/video-intelligence/projects/:projectId`):**
   * Displays project name, a prominent **History** button on the right, and a large drag-and-drop video upload zone supporting MP4, MOV, AVI, and MKV formats with file validation and upload progress.
3. **Video Setup & Calibration Studio (`/video-intelligence/projects/:projectId/videos/:videoId/setup`):**
   * First frame is automatically extracted on upload via OpenCV and displayed with original aspect ratio.
   * Interactive 4-point Ground Control Point (GCP) editor with drag, reposition, pan, zoom, and reset view controls.
   * Coordinate entry for Point 1 through Point 4 (image X/Y matched with mandatory Latitude and Longitude).
   * Real-time RANSAC planar homography calculation, metric reprojection RMSE estimation, and calibration quality grading (EXCELLENT, GOOD, POOR).
   * Optional video rename field.
   * **Final Submit** commits the calibration and launches asynchronous backend video processing.
4. **Background Video Processing Engine (`/video-intelligence/projects/:projectId/videos/:videoId/processing/:jobId`):**
   * Real-time progress monitor displaying progress percentage (0–100%), frames completed vs. total, processing speed (FPS), pipeline stage (YOLO detection, ByteTrack filtering, homography projection, video encoding), and ETA remaining.
   * Automatic redirection to the analytics page upon job completion.
   * Failure diagnostics with one-click retry action.
5. **Video Analytics Center (`/video-intelligence/projects/:projectId/videos/:videoId/analytics`):**
   * **Section A (Annotated Video Player):** Large HTML5 video player streaming the YOLOv8 + ByteTrack annotated MP4 with playback controls, seeking, and direct MP4 download.
   * **Section B (Exactly Four Visualizations):**
     * *Graph 1:* Vehicle Count Over Time (Line chart, time in seconds vs. vehicle count).
     * *Graph 2:* Average Vehicle Speed (Line chart, time in seconds vs. speed in km/h derived from homography).
     * *Graph 3:* Traffic Density (Line chart, time in seconds vs. density veh/m² or road occupancy percentage).
     * *Graph 4:* Vehicle Classification (Bar chart of vehicle class breakdown).
   * **Section C (Trajectory Observations Table):** Granular telemetry records with columns for Timestamp (s), Track ID, Vehicle Class, Image X, Image Y, Ground X (m), Ground Y (m), Latitude, Longitude, and Speed (km/h). Clicking **View** on any row instantly seeks the video player to that timestamp, highlights the target track row, and displays track details.
6. **Project History Center (`/video-intelligence/projects/:projectId/history`):**
   * Centralized archive of all videos in the project showing video name, upload timestamp, and processing status.
   * Operational actions: **Open Analytics**, **Download Annotated MP4**, **Download CSV**, **Retry Processing** (for failed jobs), and **Delete Video** (with confirmation dialog).

---

## 3. UI/UX Design System & Ergonomics

The application features a visual redesign:

### 3.1 Color Palette Architecture
* **Dark Mode (Cosmic Space Obsidian):**
  * Base Background: `#080b12`
  * Surface Containers: `#0d121f`, `#111827`, `#162035`, `#1d2a45`
  * Borders & Outlines: `#222f47` and `#2a3854`
  * Primary Accent: **Electric Indigo** (`#6366f1` / `#4338ca`)
  * Secondary (Flow & Rush): **Solar Amber** (`#fbbf24` / `#b45309`)
  * Tertiary (Optimal Flow): **Vivid Emerald** (`#10b981` / `#047857`)
  * Alert & Congestion: **Crimson Rose** (`#f43f5e` / `#9f1239`)
  * AI & Forecasts: **Neural Violet** (`#8b5cf6` / `#a855f7`)
* **Light Mode (Executive Transit Hub):**
  * Base Background: `#f8fafc`
  * Surface Containers: `#ffffff`, `#f1f5f9`, `#e2e8f0`
  * Primary Accent: **Deep Royal Indigo** (`#4f46e5` / `#e0e7ff`)
  * Secondary Accent: **Warm Amber** (`#d97706` / `#fef3c7`)
  * Tertiary Accent: **Emerald Teal** (`#059669` / `#d1fae5`)
  * Error Accent: **Crimson Red** (`#e11d48` / `#ffe4e6`)

### 3.2 Typography Hierarchy
* **KPI Metrics:** `text-5xl` to `text-6xl font-black` (48px–56px) with Space Grotesk numerals.
* **Page Titles:** `text-3xl` to `text-4xl font-extrabold` (32px–36px).
* **Section Headers:** `text-2xl font-bold` (24px–28px).
* **Body & Telemetry Copy:** `text-base font-medium` (16px) across all views.
* **System Labels & Badges:** `text-xs` / `text-sm font-mono font-bold uppercase tracking-wider`.

### 3.3 Universal Collapsible Sidebar Navigation
* **Universal Header Toggle:** Header toggle button on desktop and mobile (`menu_open` / `menu`) to expand or collapse the sidebar.
* **Integrated Collapse Button:** Dedicated `menu_open` button inside the top-right corner of the sidebar header.
* **Full-Width Canvas Adaptation:** When collapsed, the sidebar slides smoothly off-screen (`-translate-x-full`) and the dashboard expands from `lg:pl-72` to `lg:pl-0` (`transition-all duration-300`).
* **Persistent Preference:** Sidebar state (open vs. collapsed) is preserved across page reloads via `localStorage.getItem('sidebar_open')`.
* **Mobile-First Gestures:** Automatic overlay dimming and closing when selecting links on screens $< 1024\text{px}$.

---

## 4. Technology Stack

### Frontend
* **Framework:** React 19 (`react: ^19.2.8`, `react-dom: ^19.2.8`)
* **Build Tool:** Vite 8 (`vite: ^8.3.0`, `@vitejs/plugin-react: ^6.1.1`)
* **Styling & Design System:** Tailwind CSS v4 (`@tailwindcss/vite: ^4.3.3`, `tailwindcss: ^4.3.3`)
* **Typography:** Space Grotesk, Inter, JetBrains Mono, Google Material Symbols Outlined
* **Charts & Visualizations:** Recharts (`recharts: ^3.10.1`)
* **Geospatial Mapping:** Leaflet (`leaflet: ^1.9.4`, `react-leaflet: ^5.0.0`)
* **Icons:** Lucide React & Google Material Symbols
* **HTTP Client:** Axios (`axios: ^1.20.0`)

### Backend
* **Web Framework:** FastAPI (`fastapi: ^0.165.0`)
* **ASGI Server:** Uvicorn (`uvicorn: ^0.54.0`)
* **Data Schemas & Validation:** Pydantic v2 (`pydantic: ^2.14.3`, `pydantic-core`)
* **Data Manipulation & Analysis:** Pandas (`pandas: ^3.1.1`), NumPy (`numpy: ^2.4.6`)
* **Machine Learning:** Scikit-Learn (`scikit-learn: ^1.9.1`), XGBoost (`xgboost: ^3.2.0`), Joblib
* **Computer Vision & Ingest:** OpenCV Headless (`opencv-python-headless: ^5.1.0`), ONNX Runtime (`onnxruntime: ^1.32.0`), Shapely, ImageIO-FFmpeg
* **Graph Theory & Routing:** NetworkX (`networkx: ^3.6.1`)
* **Database:** SQLite3 with WAL mode (`traffic_analytics.db`)

---

## 5. Directory & File Structure

```text
Traffic_Analytics_Dashboard/
├── backend/
│   ├── app/
│   │   ├── config.py                 # Environment configurations & defaults
│   │   ├── main.py                   # FastAPI application initialization & middleware
│   │   ├── database/
│   │   │   └── database.py           # SQLite connection pool & table schemas
│   │   ├── geospatial/
│   │   │   └── geocoding.py          # Nominatim, Photon, & local landmark resolution
│   │   ├── models/
│   │   │   ├── route.py              # Pydantic models for routing requests & responses
│   │   │   ├── schemas.py            # Schemas for camera streams & trajectory points
│   │   │   └── traffic.py            # Schemas for forecasts, historical data & ML
│   │   ├── routes/
│   │   │   ├── analytics.py          # Summary KPIs & flow-rate endpoints
│   │   │   ├── cameras.py            # Camera registration & stream control endpoints
│   │   │   ├── corridors.py          # Two-camera corridor & calibration endpoints
│   │   │   ├── health.py             # System health check endpoint
│   │   │   ├── route_planner.py      # Route estimation & optimization endpoints
│   │   │   ├── traffic_forecast.py   # 24-hour forecast & historical analytics endpoints
│   │   │   ├── trajectories.py       # Trajectory point ingest & query endpoints
│   │   │   ├── video_processing.py   # Recorded video upload & export endpoints
│   │   │   └── websockets.py         # Real-time WebSocket streaming telemetry
│   │   ├── services/
│   │   │   ├── feature_engineering.py# ML feature transformers & encoders
│   │   │   ├── prediction.py         # XGBoost & historical baseline inference service
│   │   │   ├── road_network.py       # NetworkX local fallback graph engine
│   │   │   ├── routing.py            # OSRM road-network client
│   │   │   └── traffic_data.py       # Dataset queries, filters, & BPR calculations
│   │   ├── traffic/
│   │   │   └── calculations.py       # Space-mean speed & flow formulas
│   │   └── vision/
│   │       ├── detector.py           # YOLOv8 ONNX object detector wrapper
│   │       ├── tracker.py            # Multi-object ByteTrack tracking implementation
│   │       └── video_processor.py    # Offline video worker & frame annotator
│   ├── data/
│   │   ├── historical_traffic.csv    # 5,768 synthetic historical records across 8 roads
│   │   ├── traffic_analytics.db      # SQLite persistent storage for sessions & cameras
│   │   ├── trajectory_data.json      # Ground-truth trajectory coordinate points
│   │   └── yolov8n.onnx              # Pre-compiled YOLOv8 nano ONNX weights
│   ├── models/
│   │   ├── EVALUATION_REPORT.md      # Empirical ML benchmarking and evaluation findings
│   │   ├── model_metadata.json       # Hyperparameters, MAE/RMSE scores, & feature names
│   │   └── xgboost_travel_time.joblib# Serialized trained XGBoost model binary
│   ├── scripts/
│   │   └── train_model.py            # Chronological split training & evaluation pipeline
│   ├── tests/
│   │   └── test_api.py               # Automated pytest suite
│   ├── generate_demo_data.py         # Synthetic BPR dataset generation script
│   └── requirements.txt              # Pinned Python package dependencies
│
├── frontend/
│   ├── public/
│   │   └── favicon.svg               # Application radar SVG emblem
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnalyticsCharts.tsx   # Trajectory area chart & sensor status cards
│   │   │   ├── Header.tsx            # Sticky header with sidebar toggle & theme switch
│   │   │   ├── KpiRow.tsx            # High-impact numerical KPI telemetry cards
│   │   │   ├── ReportsView.tsx       # Downloadable audit exports for CSV, JSON & MP4
│   │   │   ├── Sidebar.tsx           # Collapsible drawer with navigation & active state
│   │   │   ├── TrafficMonitorDashboard.tsx # Camera streams & video inference console
│   │   │   ├── TrajectoriesSection.tsx # Raw trajectory table with CSV export
│   │   │   └── VideoPlayerFeed.tsx   # Dual annotated video playback & taxonomy counts
│   │   ├── pages/
│   │   │   ├── HistoricalAnalytics.tsx # Diurnal charts, rush windows, & weekday stats
│   │   │   ├── RoutePlanner.tsx      # Leaflet map, geocoding inputs, & route directions
│   │   │   └── TrafficForecast.tsx   # 24-hour ML travel-time forecast & period digest
│   │   ├── services/
│   │   │   ├── api.js                # Legacy trajectory & summary endpoints
│   │   │   ├── routeApi.ts           # Axios client for /api/route endpoints
│   │   │   ├── trafficApi.ts         # Axios client for /api/traffic endpoints
│   │   │   └── videoApi.ts           # Axios client for /api/video-processing endpoints
│   │   ├── App.css                   # Custom component styling
│   │   ├── App.tsx                   # Master root component with view routing
│   │   ├── index.css                 # Tailwind v4 configuration & theme color variables
│   │   ├── main.tsx                  # React DOM entry point
│   │   └── types.ts                  # TypeScript interfaces and type definitions
│   ├── index.html                    # HTML entry point with Google Fonts preloads
│   ├── package.json                  # Frontend dependencies and npm scripts
│   ├── tailwind.config.js            # Tailwind theme tokens & design system extensions
│   ├── tsconfig.json                 # TypeScript compiler configurations
│   └── vite.config.ts                # Vite build pipeline and plugin setup
│
├── 12937233_3840_2160_30fps.mp4      # High-definition 4K raw intersection test video
├── .env.example                      # Environment variable template
├── .gitignore                        # Git exclusion rules
└── README.md                         # Comprehensive master documentation (this file)
```

---

## 6. Installation & Execution Guide

### Prerequisites
* **Operating System:** Windows 10/11, macOS, or Linux
* **Python:** Version 3.10 or 3.11 (Python 3.11 recommended)
* **Node.js:** Version 18.0.0 or higher
* **Package Managers:** `pip` and `npm`

---

### 6.1 Backend Setup & Execution (FastAPI)

1. **Open PowerShell / Terminal** and navigate to the `backend` directory:
   ```powershell
   cd "c:\Users\bhave\OneDrive\Desktop\Web Projects\Traffic_Analytics_Dashboard\backend"
   ```

2. **Create and Activate a Virtual Environment:**
   ```powershell
   # Create virtual environment
   python -m venv venv

   # Activate on Windows PowerShell
   .\venv\Scripts\Activate.ps1
   ```
   *(Note: If script execution is restricted on Windows, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` prior to activation)*

3. **Install Dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

4. **Launch the FastAPI Server:**
   ```powershell
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

5. **Verify Backend Status:**
   * Health Check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) &rarr; `{"status": "ok", "message": "Backend is running"}`
   * Swagger Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   * Redoc Documentation: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

### 6.2 Frontend Setup & Execution (React + Vite)

1. **Open a Second Terminal** and navigate to the `frontend` directory:
   ```powershell
   cd "c:\Users\bhave\OneDrive\Desktop\Web Projects\Traffic_Analytics_Dashboard\frontend"
   ```

2. **Install Node Dependencies:**
   ```powershell
   npm install
   ```

3. **Start the Development Server:**
   ```powershell
   npm run dev
   ```

4. **Access the Application:**
   Open your browser to: **[http://localhost:5173](http://localhost:5173)**

---

### 6.3 Building for Production

To compile and bundle the frontend for production deployment:
```powershell
cd frontend
npm run build
```
The optimized static output will be generated inside `frontend/dist/`.

To test the production build locally:
```powershell
npm run preview
```

---

## 7. Complete API Reference

### Health & System Status
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns server status and verification confirmation |

### Route Planning & Optimization
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/route/estimate` | Computes baseline or traffic-aware route geometry and alternative paths via OSRM |
| `POST` | `/api/route/optimize` | Compares and ranks multiple routes based on travel time and segment delays |

### Traffic Forecast & Historical Analytics
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/traffic/roads` | Lists all monitored arterial road corridors in the network |
| `GET` | `/api/traffic/forecast` | Point travel-time prediction for a specific road ID, date, and hour |
| `GET` | `/api/traffic/24-hour` | 24-hour hourly predictive travel time and volume forecast curve |
| `GET` | `/api/traffic/analytics/summary` | Aggregate statistical summary across all historical dataset records |
| `GET` | `/api/traffic/analytics/hourly-pattern` | Diurnal volume and velocity distributions for a selected corridor |
| `GET` | `/api/traffic/analytics/weekday-comparison` | Comparative volume and speed statistics between weekdays and weekends |
| `GET` | `/api/traffic/analytics/peak-hours` | Algorithmic peak rush hour detection (morning vs. evening windows) |
| `GET` | `/api/traffic/analytics/congestion-trends`| Daily Congestion Index trendline over time |
| `GET` | `/api/traffic/model-info` | Metadata, hyperparameters, and evaluation metrics for the ML model |

### Trajectories & General Analytics
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/trajectories/` | Returns spatial 2D trajectory tracking points from historical file |
| `GET` | `/api/analytics/summary` | Top-level intersection KPI metrics (total vehicles, average speed) |
| `GET` | `/api/analytics/vehicles-over-time` | Flow-rate time-series histogram |

### Camera Streams & Corridors
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cameras` | Lists all registered CCTV camera nodes |
| `POST` | `/api/cameras` | Registers a new camera node (RTSP, local file, or webcam) |
| `POST` | `/api/cameras/{camera_id}/start` | Starts the camera background worker and begins frame acquisition |
| `POST` | `/api/cameras/{camera_id}/stop` | Stops the camera background worker |
| `GET` | `/api/cameras/{camera_id}/stream` | Streams live annotated frames via MJPEG (`multipart/x-mixed-replace`) |
| `GET` | `/api/corridors` | Lists all configured two-camera corridors |
| `POST` | `/api/corridors` | Creates a new two-camera corridor with road geometry lookup |
| `POST` | `/api/corridors/{corridor_id}/calibration` | Saves 4-point homography calibration matrix for physical measurements |

### Recorded Video Processing & Audit Exports
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/video-processing/upload` | Uploads video file and initiates offline YOLOv8 tracking job |
| `GET` | `/api/video-processing/session/{id}` | Polls status, frame counts, and classification statistics for a job |
| `POST` | `/api/video-processing/session/{id}/control` | Sends control actions (`pause`, `resume`, `stop`) to an active job |
| `GET` | `/api/video-processing/recordings` | Lists metadata for discovered completed annotated recordings |
| `GET` | `/api/video-processing/recordings/{id}/stream` | Streams annotated MP4 with byte-range seeking support |
| `GET` | `/api/video-processing/recordings/{id}/files/{export}` | Downloads CSV/JSON artifacts (`count_summary`, `track_details`, etc.) |
| `GET` | `/api/video-processing/latest` | Retrieves the latest completed processing session for report generation |

### Video Intelligence Workflow
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/video-intelligence/projects` | List all analysis projects |
| `POST` | `/api/video-intelligence/projects` | Create a new project (name & description) |
| `GET` | `/api/video-intelligence/projects/{id}` | Retrieve project details |
| `DELETE` | `/api/video-intelligence/projects/{id}` | Delete project and all associated files |
| `GET` | `/api/video-intelligence/projects/{id}/videos` | List all videos in a project |
| `POST` | `/api/video-intelligence/projects/{id}/videos` | Ingest and extract video metadata and first frame |
| `GET` | `/api/video-intelligence/videos/{id}` | Get individual video details |
| `PATCH` | `/api/video-intelligence/videos/{id}` | Rename video display title |
| `DELETE` | `/api/video-intelligence/videos/{id}` | Delete video, calibrations, tracks, and exports |
| `GET` | `/api/video-intelligence/videos/{id}/first-frame` | Stream extracted first frame JPEG |
| `GET` | `/api/video-intelligence/videos/{id}/thumbnail` | Stream video thumbnail image |
| `GET` | `/api/video-intelligence/videos/{id}/stream` | Stream source video file |
| `GET` | `/api/video-intelligence/videos/{id}/annotated-stream` | Stream annotated YOLOv8 + ByteTrack MP4 |
| `GET` | `/api/video-intelligence/videos/{id}/calibration` | Fetch 4-point GCP calibration and homography matrix |
| `POST` | `/api/video-intelligence/videos/{id}/calibration` | Compute RANSAC homography and reprojection RMSE |
| `POST` | `/api/video-intelligence/videos/{id}/process` | Launch background YOLOv8 + ByteTrack processing job |
| `GET` | `/api/video-intelligence/jobs/{id}` | Poll real-time progress, FPS, frame counts, and stage |
| `POST` | `/api/video-intelligence/jobs/{id}/cancel` | Cancel an active processing job |
| `GET` | `/api/video-intelligence/videos/{id}/analytics` | Retrieve telemetry summary, LOS, and time-series metrics |
| `GET` | `/api/video-intelligence/videos/{id}/trajectory-points`| Paginated observation points (timestamp, track, lat, lon, speed) |
| `GET` | `/api/video-intelligence/videos/{id}/trajectories/csv` | Direct download of trajectory observations CSV |
| `GET` | `/api/video-intelligence/videos/{id}/exports` | List generated export artifacts |
| `GET` | `/api/video-intelligence/exports/{id}/download` | Download specific export artifact (CSV, GeoJSON, JSON) |

### Frontend Application URL Architecture
Every feature in TrafficOps has a dedicated, bookmarkable URL:
| URL Path | Component / Page | Description |
|---|---|---|
| `/overview` | `VideoPlayerFeed` | Dual-camera playback & classification counters |
| `/traffic-monitor` | `TrafficMonitorDashboard` | Dual live feeds, homography setup & tripwires |
| `/route-planner` | `RoutePlanner` | GIS geocoding & multi-criteria pathfinding |
| `/traffic-forecast` | `TrafficForecast` | 24-hour diurnal ML velocity forecasting |
| `/historical-analytics`| `HistoricalAnalytics` | Volume distributions & rush-hour patterns |
| `/trajectories` | `TrajectoriesSection` | 2D pixel coordinate trajectory logging |
| `/analytics` | `KpiRow` + `AnalyticsCharts` | Network KPIs & time-series flow curves |
| `/reports` | `ReportsView` | Audited session records & export archives |
| `/video-intelligence` | `ProjectListPage` | Video intelligence projects listing & creation |
| `/video-intelligence/projects/:projectId` | `SimpleProjectWorkspace` | Video drag-and-drop upload & history launcher |
| `/video-intelligence/projects/:projectId/history` | `ProjectHistoryPage` | Video records table, MP4/CSV downloads & retry |
| `/video-intelligence/projects/:projectId/videos/:videoId/setup` | `VideoSetupPage` | First-frame viewer, 4 GCP markers & homography validation |
| `/video-intelligence/projects/:projectId/videos/:videoId/processing/:jobId` | `VideoProcessingPage` | Live progress monitor, FPS, frame counts & stage |
| `/video-intelligence/projects/:projectId/videos/:videoId/analytics` | `SimpleVideoAnalyticsPage` | Annotated player, 4 charts & trajectory table with View seeking |

---

## 8. Data Sources, Datasets & Scientific Calibration

### 8.1 Included Demonstration Data
* **`backend/data/historical_traffic.csv`:** Contains $5,768$ simulated records modeled across 8 major arterial corridors in Lucknow over 30 days using the **Bureau of Public Roads (BPR)** volume-delay equation:
  $$T = T_0 \cdot \left(1 + \alpha \cdot \left(\frac{V}{C}\right)^\beta\right)$$
  Where $T_0$ is free-flow travel time, $V$ is volume, $C$ is capacity, $\alpha = 0.15$, and $\beta = 4.0$.
* **`backend/data/trajectory_data.json`:** Ground-truth pixel coordinate trajectories capturing vehicle paths across video frames.
* **`backend/data/yolov8n.onnx`:** Pre-trained COCO object detection weights identifying standard vehicle classes.

### 8.2 Real-World Data Integration
To deploy the system in a real municipal environment:
1. **Loop Detectors / FASTag Data:** Format continuous sensor measurements into the schema defined in `historical_traffic.csv` (timestamp, corridor ID, speed, volume).
2. **CCTV Camera Ingest:** Configure RTSP camera URLs in the backend environment variables (`CAMERA_RTSP_<ID>=rtsp://user:pass@ip:port/stream`). Credentials remain on the backend and are never sent to the browser.
3. **Planar Homography Calibration:** Use the Ground-Plane Calibration tool in the Traffic Monitor to provide four surveyed GPS points corresponding to pixel markers. This translates pixel velocity ($px/s$) to physical velocity ($km/h$).

---

## 9. Testing & Quality Assurance

### Automated Backend Tests
Run the comprehensive pytest suite covering API validation, camera security, corridor distance calculations, and video stream boundaries:
```powershell
cd backend
python -m pytest -q
```

### Frontend Code Quality
Check TypeScript types and linting:
```powershell
cd frontend
npm run lint
```

---

## 10. Summary of Key Achievements

* **A-to-Z UI Modernization:** Implemented a Command Center design with custom colors, high-contrast surfaces, and large fonts.
* **Expanded Visualizations:** Chart heights increased to 380px–420px with custom dark tooltips and thick vector lines.
* **Collapsible Navigation:** Responsive sidebar that can be opened or closed on desktop and mobile, with full-width dashboard expansion.
* **Integrated Backend:** Fully operational FastAPI backend with live endpoints for routing, computer vision, forecasting, and historical telemetry.
* **Production Build Verified:** Frontend and backend compile cleanly with zero errors.
