import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.database import init_db
from app.routes import (
    trajectories,
    analytics,
    health,
    route_planner,
    traffic_forecast,
    cameras,
    corridors,
    video_processing,
    websockets,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="Traffic Analytics & Intelligent Route Planning API",
    description="Backend API for processing traffic trajectory data, intelligent route planning, and ML-based travel time prediction.",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "TRAFFIC_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(","),
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
app.include_router(cameras.router, prefix="/api/cameras", tags=["Cameras"])
app.include_router(corridors.router, prefix="/api/corridors", tags=["Corridors"])
app.include_router(
    video_processing.router,
    prefix="/api/video-processing",
    tags=["Recorded Video Processing"],
)
app.include_router(websockets.router, prefix="/api/ws", tags=["Live Updates"])
