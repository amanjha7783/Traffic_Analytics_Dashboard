from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import trajectories, analytics, health

app = FastAPI(
    title="Traffic Analytics Dashboard API",
    description="Backend API for processing and serving traffic trajectory data and analytics.",
    version="1.0.0"
)

# Configure CORS so the React frontend can communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development; restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(trajectories.router, prefix="/api/trajectories", tags=["Trajectories"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
