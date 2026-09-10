from fastapi import APIRouter
from app.models.schemas import AnalyticsSummary
from app.services.analytics_service import calculate_summary, calculate_vehicles_over_time

router = APIRouter()

@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary():
    """Returns top-level KPIs."""
    return calculate_summary()

@router.get("/vehicles-over-time")
def get_vehicles_over_time():
    """Returns vehicle count over time."""
    return calculate_vehicles_over_time()
