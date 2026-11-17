"""
Route Planner API Endpoints.

Provides baseline and traffic-aware route estimation and optimization
using real road network geometry from OpenStreetMap/OSRM and Nominatim geocoding.
"""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status
from app.models.route import (
    RouteRequest,
    RouteEstimateResponse,
    RouteOptimizeRequest,
    RouteOptimizeResponse,
    GeocodedLocation,
    RouteAlternative,
    RouteMode,
)
from app.services.geocoding import geocode_location
from app.services.routing import get_route

logger = logging.getLogger(__name__)

router = APIRouter()


def _calculate_eta(departure_time_str: str, duration_minutes: float) -> str:
    """Calculate expected arrival time given departure time HH:MM and duration."""
    try:
        parts = departure_time_str.strip().split(":")
        dep_hour = int(parts[0])
        dep_min = int(parts[1])
        now = datetime.now().replace(hour=dep_hour, minute=dep_min, second=0)
        arrival = now + timedelta(minutes=duration_minutes)
        return arrival.strftime("%H:%M")
    except Exception:
        return "N/A"


@router.post("/estimate", response_model=RouteEstimateResponse)
def estimate_route(req: RouteRequest):
    """
    Calculate baseline or traffic-aware route between two named locations.
    Uses Nominatim for geocoding and OSRM for real road geometry.
    """
    logger.info(f"Route estimate request: {req.origin} -> {req.destination} in {req.city} (Mode: {req.mode})")
    if req.mode == RouteMode.TRAFFIC_AWARE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Traffic-aware route ranking is unavailable until candidate road paths "
                "can be mapped to validated traffic forecast segments."
            ),
        )

    # Step 1: Geocode Origin
    orig_geo = geocode_location(req.origin, city=req.city)
    if not orig_geo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not resolve starting location '{req.origin}' in '{req.city}'. "
                   f"Please verify the location spelling, try adding a known landmark, or check the city name.",
        )

    # Step 2: Geocode Destination
    dest_geo = geocode_location(req.destination, city=req.city)
    if not dest_geo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not resolve destination '{req.destination}' in '{req.city}'. "
                   f"Please verify the location spelling, try adding a known landmark, or check the city name.",
        )

    # Step 3: Fetch route geometry from OSRM
    osrm_result = get_route(
        origin_lon=orig_geo["longitude"],
        origin_lat=orig_geo["latitude"],
        dest_lon=dest_geo["longitude"],
        dest_lat=dest_geo["latitude"],
        alternatives=True,
    )

    if not osrm_result or not osrm_result.get("routes"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "The road-routing service did not return a route. "
                "No straight-line distance is substituted for road geometry."
            ),
        )

    routes = [
        RouteAlternative(
            geometry_polyline=route["geometry_polyline"],
            geometry_coordinates=route["geometry_coordinates"],
            distance_km=route["distance_km"],
            duration_minutes=route["duration_minutes"],
            summary=route.get("summary", "Recommended road route"),
            steps=route.get("steps", []),
        )
        for route in osrm_result["routes"]
    ]

    # Calculate ETA if departure time provided
    arrival_time = None
    if req.departure_time and routes:
        arrival_time = _calculate_eta(req.departure_time, routes[0].duration_minutes)

    return RouteEstimateResponse(
        origin=GeocodedLocation(**orig_geo),
        destination=GeocodedLocation(**dest_geo),
        routes=routes,
        best_route_index=0,
        departure_time=req.departure_time,
        estimated_arrival_time=arrival_time,
        data_source="OSRM (OpenStreetMap Road Network)",
        is_demo_data=False,
    )


@router.post("/optimize", response_model=RouteOptimizeResponse)
def optimize_route(req: RouteOptimizeRequest):
    """
    Compare multiple candidate routes between origin and destination,
    and rank them based on travel duration and road distance.
    """
    orig_geo = geocode_location(req.origin, city=req.city)
    if not orig_geo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not resolve origin '{req.origin}' in '{req.city}'.",
        )

    dest_geo = geocode_location(req.destination, city=req.city)
    if not dest_geo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not resolve destination '{req.destination}' in '{req.city}'.",
        )

    osrm_result = get_route(
        origin_lon=orig_geo["longitude"],
        origin_lat=orig_geo["latitude"],
        dest_lon=dest_geo["longitude"],
        dest_lat=dest_geo["latitude"],
        alternatives=True,
    )

    if not osrm_result or not osrm_result.get("routes"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not calculate alternative routes from routing service.",
        )

    routes = [
        RouteAlternative(
            geometry_polyline=r["geometry_polyline"],
            geometry_coordinates=r["geometry_coordinates"],
            distance_km=r["distance_km"],
            duration_minutes=r["duration_minutes"],
            summary=r.get("summary", f"Option {i+1}"),
            steps=r.get("steps", []),
        )
        for i, r in enumerate(osrm_result["routes"])
    ]

    # Best route is the one with lowest duration
    best_idx = 0
    min_dur = float("inf")
    for i, r in enumerate(routes):
        if r.duration_minutes < min_dur:
            min_dur = r.duration_minutes
            best_idx = i

    best_r = routes[best_idx]
    reason = f"Route {best_idx + 1} ({best_r.summary}) is recommended with lowest duration of {best_r.duration_minutes} min ({best_r.distance_km} km)."

    return RouteOptimizeResponse(
        routes=routes,
        recommended_index=best_idx,
        recommendation_reason=reason,
        data_source="OSRM (OpenStreetMap Routing Machine)",
        is_demo_data=False,
    )
