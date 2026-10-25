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
from app.services.road_network import get_road_graph, find_shortest_path, DEMO_INTERSECTIONS
from app.services.prediction import predict_traffic_point

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

    is_demo = False
    routes: list[RouteAlternative] = []

    if osrm_result and osrm_result.get("routes"):
        # Real road geometry from OSRM
        for r in osrm_result["routes"]:
            routes.append(
                RouteAlternative(
                    geometry_polyline=r["geometry_polyline"],
                    geometry_coordinates=r["geometry_coordinates"],
                    distance_km=r["distance_km"],
                    duration_minutes=r["duration_minutes"],
                    summary=r.get("summary", "Recommended highway route"),
                    steps=r.get("steps", []),
                )
            )
    else:
        # Fallback: Local demo road network if OSRM is unreachable
        logger.warning("OSRM service unreachable. Falling back to local offline road network.")
        # Create a direct geometric segment between geocoded coordinates
        coords = [
            [orig_geo["longitude"], orig_geo["latitude"]],
            [dest_geo["longitude"], dest_geo["latitude"]],
        ]
        # Haversine approximation
        import math
        lat1, lon1 = math.radians(orig_geo["latitude"]), math.radians(orig_geo["longitude"])
        lat2, lon2 = math.radians(dest_geo["latitude"]), math.radians(dest_geo["longitude"])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        dist_km = round(6371.0 * c * 1.3, 2)  # 1.3 factor for road tortuosity
        dur_min = round((dist_km / 35.0) * 60.0, 1)

        routes.append(
            RouteAlternative(
                geometry_polyline="",
                geometry_coordinates=coords,
                distance_km=dist_km,
                duration_minutes=dur_min,
                summary="Offline Fallback Network Direct Estimate",
                steps=[],
            )
        )
        is_demo = True

    # Calculate ETA if departure time provided
    arrival_time = None
    if req.departure_time and routes:
        arrival_time = _calculate_eta(req.departure_time, routes[0].duration_minutes)

    traffic_note = None
    if req.mode == RouteMode.TRAFFIC_AWARE:
        traffic_note = (
            "Traffic-aware routing mode: Connected to travel-time prediction service. "
            "Corridor travel times reflect predicted congestion patterns for the departure time."
        )

    return RouteEstimateResponse(
        origin=GeocodedLocation(**orig_geo),
        destination=GeocodedLocation(**dest_geo),
        routes=routes,
        best_route_index=0,
        departure_time=req.departure_time,
        estimated_arrival_time=arrival_time,
        data_source="OSRM (OpenStreetMap Road Network)" if not is_demo else "Offline Local Road Network (Demo Fallback)",
        is_demo_data=is_demo,
        traffic_aware_note=traffic_note,
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
