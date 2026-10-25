from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import trajectories, analytics, health, route_planner, traffic_forecast

app = FastAPI(
    title="Traffic Analytics & Intelligent Route Planning API",
    description="Backend API for processing traffic trajectory data, intelligent route planning, and ML-based travel time prediction.",
    version="2.0.0"
)

# Configure CORS so the React frontend can communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(trajectories.router, prefix="/api/trajectories", tags=["Trajectories"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(route_planner.router, prefix="/api/route", tags=["Route Planner"])
app.include_router(traffic_forecast.router, prefix="/api/traffic", tags=["Traffic Forecast"])
