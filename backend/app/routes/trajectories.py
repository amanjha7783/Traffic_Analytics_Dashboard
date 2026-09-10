from fastapi import APIRouter
from typing import List
from app.models.schemas import TrajectoryPoint
from app.services.trajectory_service import load_trajectory_data, get_trajectories_by_vehicle

router = APIRouter()

@router.get("/", response_model=List[TrajectoryPoint])
def get_all_trajectories():
    """Returns all trajectory points."""
    return load_trajectory_data()

@router.get("/{vehicle_id}", response_model=List[TrajectoryPoint])
def get_vehicle_trajectories(vehicle_id: int):
    """Returns trajectory points for a specific vehicle."""
    return get_trajectories_by_vehicle(vehicle_id)
