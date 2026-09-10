from pydantic import BaseModel
from typing import List, Optional

class TrajectoryPoint(BaseModel):
    vehicle_id: int
    frame: int
    timestamp: float
    x: float
    y: float
    speed: float
    vehicle_type: str

class AnalyticsSummary(BaseModel):
    total_vehicles: int
    average_speed: float
    active_tracks: int
    risk_level: str
    risk_score: int

class VehicleCountOverTime(BaseModel):
    timestamp: float
    count: int

class DensityPoint(BaseModel):
    x: float
    y: float
    density: float
