# Traffic Analytics & Intelligent Route Planning System

An end-to-end, full-stack intelligent transportation engineering platform combining real-time computer vision traffic monitoring, vehicle trajectory analysis, OpenStreetMap road-network routing, historical telemetry analytics, and Machine Learning-based travel time prediction.

---

## 1. Project Overview

This project upgrades the original TrafficFlow dashboard into a complete **Traffic Analytics & Intelligent Route Planning System**. It bridges real-time intersection telemetry with city-scale road-network intelligence, enabling users to:
1. **Monitor live intersection telemetry:** Inspect camera feeds, track individual vehicle trajectories, and review collision-risk heatmaps.
2. **Plan optimal routes across real road networks:** Geocode origins and destinations, calculate baseline road routes via OpenStreetMap/OSRM, visualize interactive road geometry with Leaflet, and compare alternative paths.
3. **Analyze historical traffic dynamics:** Query hourly volume profiles, observe speed drops, compare weekday vs. weekend patterns, detect peak congestion windows, and track daily congestion index trends.
4. **Forecast 24-hour traffic conditions using Machine Learning:** Predict corridor travel times, velocities, and traffic volumes across all hours of the day using a trained XGBoost regression model.

---

## 2. Key Features

### Preserved Core Features
- **Traffic Monitor Matrix:** Quad (2x2) and Focused (1x1) multi-camera surveillance view with RTSP telemetry specs.
- **Vehicle Trajectory Tracking:** Dynamic spatial mapping of tracked vehicles with speed, heading, and collision potential.
- **Traffic Risk Heatmap:** Interactive spatial risk heatmap overlay with adjustable opacity controls.
- **Dynamic KPIs & AI Insights:** Real-time metrics for flow rate, average speed, collision risk score, and TTC alerts.
- **Safety Audit Reports:** Tabular incident logs with filterable severity levels and export actions.
- **Light / Dark Mode:** Full dual-theme design system powered by Tailwind CSS variables.

### Newly Added Features
- **Intelligent Route Planner (`/src/pages/RoutePlanner.tsx`):**
  - Origin, destination, and city geocoding with OpenStreetMap Nominatim and Photon APIs.
  - Interactive Leaflet map with real road geometry, polyline rendering, and custom SVG markers.
  - **Mode A (Baseline):** Shortest real road distance routing via OSRM.
  - **Mode B (Traffic-Aware):** Predictive travel-time estimation with informative delay modeling.
  - Alternative route comparison table and collapsible turn-by-turn navigation steps.
- **Historical Traffic Analytics (`/src/pages/HistoricalAnalytics.tsx`):**
  - Corridor selection dropdown and date/period range filtering.
  - Hourly volume distribution (Bar Chart) and speed curves (Line Chart).
  - Weekday versus weekend volume and speed comparison (Grouped Bar Chart).
  - Automated peak congestion hour detection (morning vs. evening rush hour windows).
  - Daily Congestion Index trendline over time.
- **24-Hour Traffic Forecast (`/src/pages/TrafficForecast.tsx`):**
  - Corridor-specific 24-hour predictive travel time, speed, and volume curves.
  - Diurnal breakdown cards comparing morning, afternoon, and evening conditions.
  - Live model telemetry card reporting XGBoost architecture, test MAE/RMSE, and training sample counts.

---

## 3. System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        React + Vite Frontend                           │
│  - Route Planner (Leaflet Map + OSRM Polylines + Alternatives)         │
│  - Historical Analytics (Recharts Volume, Speed, Weekday, Congestion)  │
│  - 24-Hour Traffic Forecast (XGBoost Inferences & Period Digest)       │
│  - Live Monitor, Trajectories, Heatmap & Safety Reports                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST (port 8000)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FastAPI Python Backend                          │
│  ├── /api/route/*        Routing & Geocoding Service                   │
│  ├── /api/traffic/*      Traffic Analytics & Forecasting Service       │
│  ├── /api/trajectories/* Trajectory Tracking Telemetry                 │
│  └── /api/analytics/*    KPIs & Real-Time Summaries                    │
└─────────────┬─────────────────────┬────────────────────┬───────────────┘
              │                     │                    │
              ▼                     ▼                    ▼
     Nominatim / Photon           OSRM API        XGBoost ML Pipeline
    (Geocoding Engine)       (Road Graph Engine)  (Travel-Time Model)
```

---

## 4. Folder Structure

```text
Traffic_Analytics_Dashboard/
│
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   ├── route.py             # Pydantic schemas for routing
│   │   │   ├── traffic.py           # Pydantic schemas for forecasts & analytics
│   │   │   └── schemas.py           # Schemas for trajectories & KPIs
│   │   ├── routes/
│   │   │   ├── route_planner.py     # Route estimation & optimization endpoints
│   │   │   ├── traffic_forecast.py  # Forecast & historical analytics endpoints
│   │   │   ├── trajectories.py      # Trajectory telemetry endpoints
│   │   │   ├── analytics.py         # Summary analytics endpoints
│   │   │   └── health.py            # API health check
│   │   ├── services/
│   │   │   ├── geocoding.py         # Nominatim & Photon geocoding with caching
│   │   │   ├── routing.py           # OSRM road-network client
│   │   │   ├── road_network.py      # NetworkX local fallback graph
│   │   │   ├── traffic_data.py      # Historical dataset querying & generation
│   │   │   ├── feature_engineering.py # ML feature transformers
│   │   │   └── prediction.py        # XGBoost inference service
│   │   └── main.py                  # FastAPI application entrypoint
│   ├── data/
│   │   ├── historical_traffic.csv   # 5,768 synthetic historical records (BPR model)
│   │   └── trajectory_data.json     # Trajectory points for CV tracking
│   ├── models/
│   │   ├── xgboost_travel_time.joblib # Serialized trained XGBoost model
│   │   ├── model_metadata.json      # Model metrics, hyperparams & test scores
│   │   └── EVALUATION_REPORT.md     # Full empirical evaluation report
│   ├── scripts/
│   │   └── train_model.py           # Chronological ML training & evaluation
│   ├── tests/
│   │   └── test_api.py              # Automated test suite (pytest)
│   ├── requirements.txt             # Python backend dependencies
│   └── venv/                        # Python virtual environment
│
├── frontend/
│   ├── src/
│   │   ├── components/              # Sidebar, Header, Video, Heatmap, etc.
│   │   ├── pages/
│   │   │   ├── RoutePlanner.tsx     # Route planning page with Leaflet map
│   │   │   ├── HistoricalAnalytics.tsx # Historical analytics with Recharts
│   │   │   ├── TrafficForecast.tsx  # 24-hour predictive forecast page
│   │   │   └── Dashboard.jsx        # Legacy dashboard view
│   │   ├── services/
│   │   │   ├── routeApi.ts          # Axios routing API client
│   │   │   ├── trafficApi.ts        # Axios traffic API client
│   │   │   └── api.js               # Trajectory & analytics API client
│   │   ├── types.ts                 # Full TypeScript definitions
│   │   ├── App.tsx                  # Main tab router & shell
│   │   └── index.css                # Tailwind CSS v4 variables
│   ├── package.json
│   └── vite.config.ts
│
├── README.md
├── .env.example
└── .gitignore
```

---

## 5. Software Requirements

- **Operating System:** Windows 10/11, macOS, or Linux
- **Python:** 3.10+ (tested on Python 3.11)
- **Node.js:** v18.0.0+ (tested on Node.js v20+)
- **Git**

---

## 6. Installation Instructions (Windows & VS Code)

### Step 1: Clone or Open Project
Open VS Code in the project root folder:
```powershell
cd E:\Traffic_Analytics_Dashboard
code .
```

### Step 2: Set up Backend Virtual Environment
Open a PowerShell terminal in VS Code:
```powershell
cd E:\Traffic_Analytics_Dashboard\backend

# Create virtual environment (if not already present)
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Upgrade pip and install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Install Frontend Dependencies
In a second terminal:
```powershell
cd E:\Traffic_Analytics_Dashboard\frontend
npm install
```

---

## 7. Starting the System

### Start the FastAPI Backend
In the backend terminal (with virtual environment activated):
```powershell
cd E:\Traffic_Analytics_Dashboard\backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- API Root: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

### Start the React Frontend
In the frontend terminal:
```powershell
cd E:\Traffic_Analytics_Dashboard\frontend
npm run dev
```
- Dashboard UI: `http://localhost:5173`

---

## 8. Dataset Strategy & Data Sources

### Demonstration Data (Included)
The repository includes a clearly labeled synthetic dataset in `backend/data/historical_traffic.csv` generated using the standard **Bureau of Public Roads (BPR)** volume-delay relationship across 8 arterial road corridors in Lucknow over 30 days (5,768 records).
- All API responses and UI cards explicitly display the **`SIMULATED DEMO DATA`** indicator.

### Connecting Real-World Datasets
1. **Caltrans PeMS (Freeway Performance Measurement System):**
   - Source: [Caltrans PeMS](https://dot.ca.gov/programs/traffic-operations/mpr/pems-source)
   - Contains 5-minute loop-detector volumes, occupancies, and speeds across California highways.
2. **OpenStreetMap (Road Graph & Geometry):**
   - Source: [OpenStreetMap](https://www.openstreetmap.org)
   - Provides free road alignments, lane numbers, speed limits, and junction topologies.
3. **City-Specific Telemetry (India):**
   - Deploying for an Indian city (e.g. Lucknow, Delhi, Bengaluru) requires integrating local municipal traffic camera feeds, TomTom/Google licensed probe data, or FASTag toll telemetry.
   - Simply format data to match the expected schema below and place it at `backend/data/historical_traffic.csv`.

### Expected Dataset Schema

| Column | Type | Unit | Description |
|---|---|---|---|
| `timestamp` | string (ISO-8601) | `YYYY-MM-DDTHH:MM:SS` | Measurement date and time |
| `road_segment_id` | string | e.g. `RS-01` | Unique corridor identifier |
| `road_name` | string | text | Descriptive name of corridor |
| `speed_kmh` | float | km/h | Observed space-mean speed |
| `volume` | integer | vehicles / hour | Detected hourly traffic volume |
| `travel_time_seconds` | float | seconds | Segment traversal time: `(length / speed) * 3600` |
| `road_length_km` | float | kilometers | Physical length of road segment |
| `num_lanes` | integer | count | Number of traffic lanes |
| `speed_limit_kmh` | float | km/h | Posted regulatory speed limit |
| `is_demo_data` | boolean | bool | `true` if synthetic, `false` if sensor-measured |

---

## 9. Machine Learning Pipeline & Training

The travel-time prediction model is trained using **XGBoost Regressor** with strict **chronological time-series splitting** (no random shuffling, preventing future data leakage into the past).

### Input Features
1. `hour` (0 to 23)
2. `day_of_week` (0 to 6, Monday=0)
3. `is_weekend` (0 or 1)
4. `is_peak_hour` (1 during 08:00–10:00 & 17:00–20:00)
5. `road_length_km`
6. `num_lanes`
7. `speed_limit_kmh`
8. `road_segment_code` (numerical corridor encoding)
9. `volume` (traffic flow rate)

### Target Variable
- `travel_time_seconds` (in seconds)

### Training Command
To retrain the model and regenerate evaluation metrics:
```powershell
cd E:\Traffic_Analytics_Dashboard\backend
.\venv\Scripts\python.exe scripts/train_model.py
```

### Empirical Evaluation Results (on held-out test split)
- **Dataset Size:** 5,768 records
- **Split:** Chronological (70% Train = 4,037, 15% Val = 865, 15% Test = 866)
- **Baseline (Segment + Hour Mean):**
  - MAE: **17.01s**
  - RMSE: **26.31s**
  - R²: **0.8851**
- **XGBoost Regressor:**
  - MAE: **55.43s**
  - RMSE: **65.79s**
  - R²: **0.2816**
- *Note:* Detailed findings and limitations are documented in `backend/models/EVALUATION_REPORT.md`.

---

## 10. Route Planner Workflow

1. **User Input:** Enter Origin (e.g., "Charbagh Railway Station"), Destination (e.g., "University of Lucknow"), City ("Lucknow"), Departure Time ("18:30"), and select a Routing Mode.
2. **Geocoding:** The backend resolves locations to coordinates via verified regional landmark lookup, followed by OpenStreetMap Nominatim and Photon search.
3. **Graph Routing:** The backend queries the OSRM road engine to calculate realistic route geometry, turn maneuvers, and driving distances based on actual OpenStreetMap vector data.
4. **Mode A (Baseline):** Returns the shortest road-distance route.
5. **Mode B (Traffic-Aware):** Evaluates corridor travel-time estimates using the ML predictor for the requested departure time.
6. **Map Rendering:** The frontend renders the decoded GeoJSON coordinates on an interactive Leaflet map, fits the viewport bounds, draws custom origin/destination pins, and presents alternative route options.

---

## 11. API Documentation

### Route Endpoints
- `POST /api/route/estimate`: Compute baseline or traffic-aware route geometry and alternatives.
  - Body: `{"origin": "...", "destination": "...", "city": "...", "departure_time": "18:30", "mode": "baseline"}`
- `POST /api/route/optimize`: Compare and rank candidate routes by duration and distance.

### Traffic Forecast & Analytics Endpoints
- `GET /api/traffic/roads`: List all monitored road segments.
- `GET /api/traffic/forecast?road_segment_id=RS-01&timestamp=2026-10-25T18:30:00`: Point forecast for specific road and time.
- `GET /api/traffic/24-hour?road_segment_id=RS-01&date=2026-10-25`: 24-hour forecast series.
- `GET /api/traffic/analytics/summary`: Aggregate metrics across historical records.
- `GET /api/traffic/analytics/hourly-pattern?road_segment_id=RS-01`: Diurnal volume and speed patterns.
- `GET /api/traffic/analytics/weekday-comparison?road_segment_id=RS-01`: Weekday vs. weekend comparison.
- `GET /api/traffic/analytics/peak-hours?road_segment_id=RS-01`: Rush hour detection.
- `GET /api/traffic/analytics/congestion-trends?road_segment_id=RS-01`: Daily congestion index trends.
- `GET /api/traffic/model-info`: ML model metadata, architecture, and evaluation metrics.

### Preserved Existing Endpoints
- `GET /api/health`: Backend health check.
- `GET /api/trajectories/`: Trajectory points for camera tracking.
- `GET /api/analytics/summary`: Top-level intersection KPIs.
- `GET /api/analytics/vehicles-over-time`: Flow rate time series.

---

## 12. Testing & Verification

### Running Automated Backend Tests
Run the pytest test suite:
```powershell
cd E:\Traffic_Analytics_Dashboard\backend
.\venv\Scripts\python.exe -m pytest tests/test_api.py -v
```
All 9 unit tests cover:
- Health check
- Trajectory ingestion
- Overview analytics
- Monitored roads listing
- 24-hour traffic forecasting
- Historical analytics and peak hour detection
- Model telemetry reporting
- Route parameter validation
- Geocoding error handling for unresolvable locations

### Running Frontend Production Build
Verify TypeScript compilation and bundling:
```powershell
cd E:\Traffic_Analytics_Dashboard\frontend
npm run build
```
Builds cleanly with zero errors in ~700ms.

---

## 13. Feature Implementation Status

| Feature | Status | Provenance & Notes |
|---|---|---|
| **Traffic Monitor View** | Genuinely Implemented | Uses local video asset & camera stream switcher |
| **Trajectory Tracking** | Genuinely Implemented | Served from `trajectory_data.json` via `/api/trajectories` |
| **Risk Heatmap** | Genuinely Implemented | Canvas overlay with opacity slider & hotspot detection |
| **Route Planner** | Genuinely Implemented | Real OSM road geometry from OSRM + Nominatim geocoding |
| **Leaflet Map Integration** | Genuinely Implemented | Interactive vector polylines, SVG pins, auto-fitting bounds |
| **Alternative Routes** | Genuinely Implemented | Ranked comparison table with selectable preview |
| **Baseline Routing** | Genuinely Implemented | Shortest real road distance |
| **Traffic-Aware Routing** | Implemented with Simulation | Integrated with ML travel-time predictions; clearly tagged |
| **24-Hour Forecast** | Genuinely Implemented | Powered by trained XGBoost Regressor |
| **Historical Analytics** | Genuinely Implemented | Diurnal volume, speed profiles, weekday vs weekend, peak hours |
| **Light / Dark Mode** | Genuinely Implemented | Dual theme switcher with full CSS variable mapping |

---

## 14. Current Limitations

1. **Synthetic Historical Dataset:** Real-time arterial sensors (loop detectors or licensed probe GPS feeds) are required for field deployment; the current demonstration uses BPR synthetic generation.
2. **OSRM Public Demo Server:** The public OSRM demo server has soft rate limits. For production city-scale routing, host a dedicated local OSRM instance using Docker (`osrm/osrm-backend`).
3. **Nominatim Usage Policy:** Complies with the 1 request/second rule using built-in rate-limiting and pre-cached landmarks.
