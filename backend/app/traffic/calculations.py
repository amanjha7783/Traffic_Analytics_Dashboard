from math import isfinite
from typing import Iterable, Optional, Sequence


def average_speed_kmh(distance_m: float, travel_time_seconds: float) -> Optional[float]:
    if not isfinite(distance_m) or not isfinite(travel_time_seconds):
        return None
    if distance_m <= 0 or travel_time_seconds <= 0:
        return None
    return distance_m / 1000 / travel_time_seconds * 3600


def traffic_density(
    unique_vehicles: int,
    road_length_m: Optional[float],
    lane_count: Optional[int] = None,
) -> dict:
    if unique_vehicles < 0 or road_length_m is None or road_length_m <= 0:
        return {"vehicles_per_km": None, "vehicles_per_km_per_lane": None}
    density = unique_vehicles / (road_length_m / 1000)
    per_lane = density / lane_count if lane_count and lane_count > 0 else None
    return {
        "vehicles_per_km": density,
        "vehicles_per_km_per_lane": per_lane,
    }


def road_occupancy(
    vehicle_footprints: Iterable[Sequence[Sequence[float]]],
    road_surface: Sequence[Sequence[float]],
) -> Optional[float]:
    """Return polygon-union occupancy; missing/invalid calibration yields no metric."""
    if len(road_surface) < 3:
        return None
    try:
        from shapely.geometry import Polygon
        from shapely.ops import unary_union
    except ImportError as exc:
        raise RuntimeError("Shapely is required for calibrated road occupancy") from exc

    road = Polygon(road_surface)
    if road.is_empty or not road.is_valid or road.area <= 0:
        return None
    polygons = []
    for coordinates in vehicle_footprints:
        footprint = Polygon(coordinates)
        if footprint.is_valid and not footprint.is_empty and footprint.area > 0:
            clipped = footprint.intersection(road)
            if not clipped.is_empty:
                polygons.append(clipped)
    if not polygons:
        return 0.0
    return min(100.0, unary_union(polygons).area / road.area * 100.0)


def congestion_index(
    *,
    density_vpkm: Optional[float],
    occupancy_percent: Optional[float],
    average_speed_kmh: Optional[float],
    speed_limit_kmh: Optional[float],
    volume_vph: Optional[float],
    capacity_vph: Optional[float],
    thresholds: Optional[dict] = None,
) -> dict:
    """Compute a transparent 0-100 index using only supplied measurements."""
    weights = {"density": 0.30, "occupancy": 0.30, "speed": 0.25, "capacity": 0.15}
    components = {}
    if density_vpkm is not None and density_vpkm >= 0:
        components["density"] = min(1.0, density_vpkm / 150.0)
    if occupancy_percent is not None and occupancy_percent >= 0:
        components["occupancy"] = min(1.0, occupancy_percent / 100.0)
    if (
        average_speed_kmh is not None
        and speed_limit_kmh is not None
        and speed_limit_kmh > 0
        and average_speed_kmh >= 0
    ):
        components["speed"] = 1.0 - min(1.0, average_speed_kmh / speed_limit_kmh)
    if (
        volume_vph is not None
        and capacity_vph is not None
        and capacity_vph > 0
        and volume_vph >= 0
    ):
        components["capacity"] = min(1.0, volume_vph / capacity_vph)
    if not components:
        return {"index": None, "level": "Unavailable", "components": {}}

    active_weight = sum(weights[name] for name in components)
    index = sum(weights[name] * value for name, value in components.items()) / active_weight * 100
    limits = thresholds or {
        "free_flow": 20,
        "low_traffic": 40,
        "moderate": 60,
        "heavy": 80,
    }
    if index < limits["free_flow"]:
        level = "Free Flow"
    elif index < limits["low_traffic"]:
        level = "Low Traffic"
    elif index < limits["moderate"]:
        level = "Moderate Traffic"
    elif index < limits["heavy"]:
        level = "Heavy Traffic"
    else:
        level = "Severe Congestion"
    return {
        "index": round(index, 2),
        "level": level,
        "components": {name: round(value, 4) for name, value in components.items()},
    }
