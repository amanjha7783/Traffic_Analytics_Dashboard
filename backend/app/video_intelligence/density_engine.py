"""
Traffic Density, Occupancy, Flow Rate, and Spatial Heatmap Engine.
Computes real-world transportation metrics:
- Vehicle Density (veh/m^2 and veh/km^2)
- Road Occupancy Percentage (Occupied Footprint / Monitored Area)
- Flow Rate across Virtual Counting Gates (veh/h)
- Mean, Median, and Maximum Velocities (km/h)
- Level of Service (LOS) Congestion Categorization
- 2D Spatial Density and Trajectory Heatmaps
"""
from typing import Sequence, Tuple, List, Dict, Any, Optional
import math
import numpy as np
import cv2

# Standard vehicle footprint area references (in square meters) per IRC standards
VEHICLE_FOOTPRINT_M2 = {
    "TWO-WHEELER": 1.52,
    "THREE-WHEELER": 3.51,
    "FOUR-WHEELER": 7.92,
    "BUS": 28.75,
    "TRUCK": 20.40,
    "BICYCLE": 0.85,
    "OTHER": 5.25,
    "PEDESTRIAN": 0.25,
}


def classify_congestion_level(occupancy_percent: float, avg_speed_kmh: Optional[float] = None) -> str:
    """Classify congestion Level of Service (LOS) based on road occupancy and velocity."""
    if occupancy_percent < 15.0:
        return "Free Flow (LOS A/B)"
    elif occupancy_percent < 28.0:
        return "Stable Flow (LOS C)"
    elif occupancy_percent < 45.0:
        return "Approaching Capacity (LOS D)"
    elif occupancy_percent < 65.0:
        return "Congested (LOS E)"
    else:
        return "Severe Gridlock (LOS F)"


def calculate_traffic_density(
    active_vehicles_count: int,
    monitored_area_m2: float
) -> Dict[str, float]:
    """Calculate vehicle density per square meter and per square kilometer."""
    if monitored_area_m2 <= 0.0:
        return {"density_per_m2": 0.0, "density_per_km2": 0.0}
    density_m2 = active_vehicles_count / monitored_area_m2
    density_km2 = density_m2 * 1000000.0  # 1 km^2 = 1,000,000 m^2
    return {
        "density_per_m2": round(density_m2, 6),
        "density_per_km2": round(density_km2, 2),
    }


def calculate_road_occupancy(
    vehicles_present: Sequence[Dict[str, Any]],
    monitored_area_m2: float
) -> float:
    """
    Calculate road occupancy percentage:
    Total footprint area occupied by vehicles divided by total monitored road area.
    """
    if monitored_area_m2 <= 0.0:
        return 0.0
    total_footprint = 0.0
    for v in vehicles_present:
        v_class = v.get("vehicle_class", "FOUR-WHEELER")
        area = VEHICLE_FOOTPRINT_M2.get(v_class, 7.92)
        total_footprint += area

    occupancy = (total_footprint / monitored_area_m2) * 100.0
    return round(min(100.0, max(0.0, occupancy)), 2)


def calculate_gate_flow_rate(
    crossing_count: int,
    interval_seconds: float
) -> float:
    """Calculate traffic flow rate in vehicles per hour (veh/h)."""
    if interval_seconds <= 0.0:
        return 0.0
    return round((crossing_count / interval_seconds) * 3600.0, 1)


def generate_heatmap_grid(
    points: Sequence[Sequence[float]],
    grid_width: int = 100,
    grid_height: int = 100,
    bounds: Optional[Tuple[float, float, float, float]] = None,
    sigma: float = 2.5
) -> Dict[str, Any]:
    """
    Generate normalized 2D Gaussian Kernel Density Estimation (KDE) heatmap grid.
    Can be computed in image pixel coordinates or ground metric coordinates.
    Returns:
      - grid: list of list of normalized float intensities (0.0 to 1.0)
      - max_intensity: float
      - width: int
      - height: int
      - bounds: [min_x, min_y, max_x, max_y]
    """
    if not points:
        return {
            "grid": [[0.0] * grid_width for _ in range(grid_height)],
            "max_intensity": 0.0,
            "width": grid_width,
            "height": grid_height,
            "bounds": [0, 0, grid_width, grid_height]
        }

    pts = np.asarray(points, dtype=np.float32)
    if bounds is None:
        min_x, min_y = float(np.min(pts[:, 0])), float(np.min(pts[:, 1]))
        max_x, max_y = float(np.max(pts[:, 0])), float(np.max(pts[:, 1]))
        # Add slight padding
        dx = max(1.0, max_x - min_x) * 0.05
        dy = max(1.0, max_y - min_y) * 0.05
        bounds = (min_x - dx, min_y - dy, max_x + dx, max_y + dy)

    min_x, min_y, max_x, max_y = bounds
    range_x = max(1e-5, max_x - min_x)
    range_y = max(1e-5, max_y - min_y)

    grid = np.zeros((grid_height, grid_width), dtype=np.float32)

    for pt in pts:
        x, y = pt[0], pt[1]
        gx = int(((x - min_x) / range_x) * (grid_width - 1))
        gy = int(((y - min_y) / range_y) * (grid_height - 1))
        if 0 <= gx < grid_width and 0 <= gy < grid_height:
            grid[gy, gx] += 1.0

    # Smooth with Gaussian filter
    kernel_size = int(math.ceil(sigma * 3) * 2 + 1)
    kernel_size = max(3, min(31, kernel_size | 1))
    smoothed = cv2.GaussianBlur(grid, (kernel_size, kernel_size), sigma)

    max_val = float(np.max(smoothed))
    if max_val > 0:
        smoothed /= max_val

    return {
        "grid": [[round(float(val), 3) for val in row] for row in smoothed],
        "max_intensity": round(max_val, 2),
        "width": grid_width,
        "height": grid_height,
        "bounds": [round(b, 2) for b in bounds],
    }
