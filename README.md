# Traffic Analytics Dashboard

## Overview

The Traffic Analytics Dashboard is a full-stack application designed to take raw outputs from a computer vision pipeline and present them as a clear, visual story. It provides real-time traffic monitoring, vehicle trajectory tracking, collision risk heatmaps, and spatial analytics in a beautifully designed, dark-themed UI.

## Features

- **Live Traffic Feed:** Native video playback displaying the annotated computer vision output.
- **Trajectory Tracking:** Real-time point tracking of vehicles across the intersection mapped onto a top-down view.
- **Risk Heatmap:** AI-generated spatial risk analysis based on trajectory density and deceleration variance. Features map view, heatmap view, and an adjustable overlay view.
- **Dynamic KPIs:** Key Performance Indicators summarizing traffic flow, average speeds, and incident potentials updated in real time.
- **Analytics Charts:** Time-series charts showing vehicle density and distribution over time.

## Architecture

Video
↓
Computer Vision Output (Mocked/Pipeline)
↓
Trajectory Data
↓
FastAPI Backend (`/backend`)
↓
React Dashboard (`/frontend`)
↓
Analytics + Risk Visualization

## Project Structure

```text
Traffic_Analytics_Dashboard/
│
├── frontend/                     # React UI (Vite + Tailwind v4 + TypeScript)
│   ├── public/assets/
│   │   ├── images/               # Map & Heatmap images
│   │   └── video/                # Annotated traffic video
│   ├── src/
│   │   ├── components/           # UI Components
│   │   ├── data/                 # Static fallback data
│   │   ├── services/             # Axios API calls to backend
│   │   ├── App.tsx               # Main Dashboard layout & data binding
│   │   └── main.tsx              # Entry point
│   └── package.json              
│
├── backend/                      # FastAPI Backend
│   ├── app/
│   │   ├── routes/               # API endpoints (trajectories, analytics)
│   │   ├── services/             # Business logic & data processing
│   │   ├── models/               # Pydantic data models
│   │   └── main.py               # API Entry point
│   ├── data/                     # Backend data processing/storage
│   └── requirements.txt
│
├── README.md
├── .gitignore
└── .env.example
```

## Requirements

- **Node.js** (v18+)
- **Python** (3.8+)

## Backend Setup

Navigate to the backend directory, install the requirements, and start the FastAPI server:

```bash
cd backend
python -m venv venv
# Windows: .\venv\Scripts\Activate.ps1
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
The API will be available at `http://localhost:8000`.

## Frontend Setup

Navigate to the frontend directory, install dependencies, and start the Vite development server:

```bash
cd frontend
npm install
npm run dev
```
The Dashboard will be available at `http://localhost:5173`.

## Assets & Media

- **Live Traffic Feed:** The annotated traffic video (`annotated-junction-67.mp4`) is rendered natively in the Video section.
- **Map Visualization:** The original intersection map (`intersection-map.jpeg`) provides the base layer.
- **Risk Visualization:** The AI-generated heatmap (`traffic-risk-heatmap.jpeg`) provides the risk overlay.

*Note: If backend API endpoints are unreachable, the frontend is designed to gracefully load simulated demo data for UI presentation purposes.*

## UI/UX Approach

The dashboard tells the story through five core elements:
1. **Video** shows the real traffic scene.
2. **KPIs** summarize the current state of traffic.
3. **Trajectories** show individual vehicle movement dynamically.
4. **Heatmap** reveals spatial concentration and conflict zones.
5. **Analytics** explain patterns and metrics over time.

## Future Improvements

- Fully integrated real-time computer vision pipeline inference.
- More accurate collision-risk estimation (TTC logic).
- Live camera (RTSP) stream integration.
- Historical traffic analysis and querying.
- Real geographic mapping integration (e.g., Leaflet/Mapbox).
