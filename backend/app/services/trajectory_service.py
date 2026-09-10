import json
import os
from typing import List
from app.models.schemas import TrajectoryPoint

DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "trajectory_data.json")

def load_trajectory_data() -> List[TrajectoryPoint]:
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r") as f:
        data = json.load(f)
        return [TrajectoryPoint(**item) for item in data]

def get_trajectories_by_vehicle(vehicle_id: int) -> List[TrajectoryPoint]:
    data = load_trajectory_data()
    return [p for p in data if p.vehicle_id == vehicle_id]
