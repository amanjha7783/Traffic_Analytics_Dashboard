"""
Routing service using OSRM public demo API.

Uses the OSRM demo server for actual road-network routing.
Provides real distances and durations based on OpenStreetMap road data.
"""
import logging
from typing import List, Optional, Tuple
import httpx

logger = logging.getLogger(__name__)

OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving"


def _decode_polyline(encoded: str, precision: int = 5) -> List[List[float]]:
    """
    Decode a Google-encoded polyline string into a list of [longitude, latitude] pairs.

    Args:
        encoded: Encoded polyline string from OSRM.
        precision: Coordinate precision (5 for OSRM default).

    Returns:
        List of [longitude, latitude] coordinate pairs.
    """
    coordinates = []
    index = 0
    lat = 0
    lng = 0
    factor = 10 ** precision

    while index < len(encoded):
        # Decode latitude
        shift = 0
        result = 0
        while True:
            byte = ord(encoded[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        lat += (~(result >> 1) if (result & 1) else (result >> 1))

        # Decode longitude
        shift = 0
        result = 0
        while True:
            byte = ord(encoded[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        lng += (~(result >> 1) if (result & 1) else (result >> 1))

        coordinates.append([lng / factor, lat / factor])

    return coordinates


def get_route(
    origin_lon: float,
    origin_lat: float,
    dest_lon: float,
    dest_lat: float,
    alternatives: bool = True,
) -> Optional[dict]:
    """
    Get a route from OSRM between two coordinate pairs.

    Args:
        origin_lon: Origin longitude
        origin_lat: Origin latitude
        dest_lon: Destination longitude
        dest_lat: Destination latitude
        alternatives: Whether to request alternative routes

    Returns:
        Dict with route data including geometry, distance, duration, steps.
        Returns None on failure.
    """
    coords = f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    url = f"{OSRM_BASE_URL}/{coords}"

    params = {
        "overview": "full",
        "geometries": "polyline",
        "steps": "true",
        "alternatives": "true" if alternatives else "false",
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

        if data.get("code") != "Ok":
            logger.error(f"OSRM error: {data.get('code')} - {data.get('message', '')}")
            return None

        routes = []
        for route in data.get("routes", []):
            geometry_encoded = route.get("geometry", "")
            decoded_coords = _decode_polyline(geometry_encoded) if geometry_encoded else []

            # Extract steps from the first leg
            steps = []
            for leg in route.get("legs", []):
                for step in leg.get("steps", []):
                    maneuver = step.get("maneuver", {})
                    instruction = _build_instruction(step, maneuver)
                    steps.append({
                        "instruction": instruction,
                        "distance_m": step.get("distance", 0),
                        "duration_s": step.get("duration", 0),
                    })

            routes.append({
                "geometry_polyline": geometry_encoded,
                "geometry_coordinates": decoded_coords,
                "distance_km": round(route.get("distance", 0) / 1000, 2),
                "duration_minutes": round(route.get("duration", 0) / 60, 1),
                "summary": _get_route_summary(route),
                "steps": steps,
            })

        return {
            "routes": routes,
            "waypoints": data.get("waypoints", []),
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"OSRM HTTP error: {e.response.status_code}")
        return None
    except httpx.RequestError as e:
        logger.error(f"OSRM request error: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected routing error: {e}")
        return None


def _build_instruction(step: dict, maneuver: dict) -> str:
    """Build a human-readable instruction from an OSRM step."""
    step_type = maneuver.get("type", "")
    modifier = maneuver.get("modifier", "")
    name = step.get("name", "")

    if step_type == "depart":
        return f"Head {modifier} on {name}" if name else f"Depart heading {modifier}"
    elif step_type == "arrive":
        return "Arrive at destination"
    elif step_type == "turn":
        return f"Turn {modifier} onto {name}" if name else f"Turn {modifier}"
    elif step_type == "continue":
        return f"Continue on {name}" if name else "Continue straight"
    elif step_type == "roundabout":
        return f"Enter roundabout and exit onto {name}" if name else "Enter roundabout"
    elif step_type == "merge":
        return f"Merge onto {name}" if name else f"Merge {modifier}"
    elif step_type == "fork":
        return f"Take the {modifier} fork onto {name}" if name else f"Take the {modifier} fork"
    else:
        if name:
            return f"{step_type.capitalize()} onto {name}"
        return step_type.capitalize() if step_type else "Continue"


def _get_route_summary(route: dict) -> str:
    """Extract a summary for the route from leg summaries."""
    summaries = []
    for leg in route.get("legs", []):
        summary = leg.get("summary", "")
        if summary:
            summaries.append(summary)
    return " via ".join(summaries) if summaries else "Direct route"
