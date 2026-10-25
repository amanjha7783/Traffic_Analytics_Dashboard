"""
Pydantic models for Route Planning endpoints.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class RouteMode(str, Enum):
    """Route calculation mode."""
    BASELINE = "baseline"
    TRAFFIC_AWARE = "traffic_aware"


class RouteRequest(BaseModel):
    """Request body for route estimation."""
    origin: str = Field(..., description="Origin location name, e.g. 'Railway Station'")
    destination: str = Field(..., description="Destination location name, e.g. 'University'")
    city: str = Field("Lucknow", description="City name used for geocoding context")
    departure_date: Optional[str] = Field(None, description="Departure date in YYYY-MM-DD format")
    departure_time: Optional[str] = Field(None, description="Departure time in HH:MM format (24h)")
    mode: RouteMode = Field(RouteMode.BASELINE, description="Route mode: baseline or traffic_aware")


class GeocodedLocation(BaseModel):
    """A geocoded location with coordinates."""
    name: str
    display_name: str
    latitude: float
    longitude: float
    data_source: str = "Nominatim (OpenStreetMap)"


class RouteStep(BaseModel):
    """A single step/maneuver in the route."""
    instruction: str
    distance_m: float
    duration_s: float


class RouteAlternative(BaseModel):
    """A single route alternative."""
    geometry_polyline: str = Field(..., description="Encoded polyline geometry")
    geometry_coordinates: List[List[float]] = Field(
        ..., description="Decoded coordinates as [[lng, lat], ...]"
    )
    distance_km: float
    duration_minutes: float
    summary: str = ""
    steps: List[RouteStep] = []


class RouteEstimateResponse(BaseModel):
    """Response for route estimation."""
    origin: GeocodedLocation
    destination: GeocodedLocation
    routes: List[RouteAlternative]
    best_route_index: int = 0
    departure_time: Optional[str] = None
    estimated_arrival_time: Optional[str] = None
    data_source: str = "OSRM (OpenStreetMap Routing Machine)"
    is_demo_data: bool = False
    traffic_aware_note: Optional[str] = None


class RouteOptimizeRequest(BaseModel):
    """Request body for route optimization/comparison."""
    origin: str
    destination: str
    city: str = "Lucknow"
    departure_date: Optional[str] = None
    departure_time: Optional[str] = None


class RouteOptimizeResponse(BaseModel):
    """Response for route optimization."""
    routes: List[RouteAlternative]
    recommended_index: int = 0
    recommendation_reason: str = ""
    data_source: str = "OSRM (OpenStreetMap Routing Machine)"
    is_demo_data: bool = False
    note: str = (
        "Route optimization is based on distance and estimated travel time from OSRM. "
        "Real-time traffic-aware optimization requires a live traffic data feed."
    )


class ErrorResponse(BaseModel):
    """Standard error response."""
    detail: str
    error_code: Optional[str] = None
