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
    active_tracks: Optional[int] = None
    risk_level: Optional[str] = None
    risk_score: Optional[int] = None
    data_source: str = "HISTORICAL TRAJECTORY FILE"
    is_demo_data: bool = True

class VehicleCountOverTime(BaseModel):
    timestamp: float
    count: int

class DensityPoint(BaseModel):
    x: float
    y: float
    density: float
