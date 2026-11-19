"""
Real-World Road Area and Geometric Measurement Engine.
Transforms pixel polygon vertices to ground metric coordinates using homography
and calculates accurate physical area (m^2), perimeter (m), and estimated roadway width using Shapely.
"""
from typing import Sequence, Tuple, List, Dict, Any, Optional
import math
import numpy as np
from shapely.geometry import Polygon, LineString
from shapely.validation import explain_validity

from app.video_intelligence.homography import transform_polygon_to_ground


def measure_region_geometry(
    vertices_pixel: Sequence[Sequence[float]],
    homography_matrix: Optional[Sequence[Sequence[float]]] = None,
) -> Dict[str, Any]:
    """
    Measure region real-world physical properties using Shapely and projective planar homography.
    Validates:
      - At least 3 distinct vertices.
      - Non-self-intersecting valid topology.
      - Positive non-zero area.
      - Derived real-world area in m² and perimeter in meters.
    """
    if len(vertices_pixel) < 3:
        return {
            "area_m2": None,
            "perimeter_m": None,
            "road_width_m": None,
            "vertices_ground": [],
            "calibrated": False,
            "is_valid": False,
            "error": "Polygon must contain at least 3 distinct vertices."
        }

    # Distinct vertices check
    unique_pixel_pts = set((round(float(p[0]), 1), round(float(p[1]), 1)) for p in vertices_pixel)
    if len(unique_pixel_pts) < 3:
        return {
            "area_m2": None,
            "perimeter_m": None,
            "road_width_m": None,
            "vertices_ground": [],
            "calibrated": False,
            "is_valid": False,
            "error": "Polygon must have at least 3 unique non-collinear vertices."
        }

    if not homography_matrix:
        return {
            "area_m2": None,
            "perimeter_m": None,
            "road_width_m": None,
            "vertices_ground": [],
            "calibrated": False,
            "is_valid": True,
            "note": "Camera homography is uncalibrated. Physical metric area requires planar calibration."
        }

    try:
        ground_vertices = transform_polygon_to_ground(vertices_pixel, homography_matrix)
        poly = Polygon(ground_vertices)

        if not poly.is_valid:
            validity_reason = explain_validity(poly)
            return {
                "area_m2": None,
                "perimeter_m": None,
                "road_width_m": None,
                "vertices_ground": [[round(x, 3), round(y, 3)] for x, y in ground_vertices],
                "calibrated": True,
                "is_valid": False,
                "error": f"Invalid polygon topology: {validity_reason}. Ensure edges do not self-intersect."
            }


        area_m2 = float(poly.area)
        perimeter_m = float(poly.length)

        if area_m2 <= 0.01:
            return {
                "area_m2": 0.0,
                "perimeter_m": round(perimeter_m, 2),
                "road_width_m": 0.0,
                "vertices_ground": [[round(x, 3), round(y, 3)] for x, y in ground_vertices],
                "calibrated": True,
                "is_valid": False,
                "error": "Polygon area is zero or degenerate."
            }

        # Estimate average road width via minimum rotated bounding box
        try:
            min_rect = poly.minimum_rotated_rectangle
            rect_coords = list(min_rect.exterior.coords)
            edge_lengths = [
                math.hypot(rect_coords[i][0] - rect_coords[i+1][0], rect_coords[i][1] - rect_coords[i+1][1])
                for i in range(len(rect_coords) - 1)
            ]
            road_width_m = min(edge_lengths) if edge_lengths else (perimeter_m / 4.0)
        except Exception:
            road_width_m = perimeter_m / 4.0

        return {
            "area_m2": round(area_m2, 2),
            "perimeter_m": round(perimeter_m, 2),
            "road_width_m": round(road_width_m, 2),
            "vertices_ground": [[round(x, 3), round(y, 3)] for x, y in ground_vertices],
            "calibrated": True,
            "is_valid": True,
            "note": "Metric geometry calculated via planar homography projection."
        }
    except Exception as e:
        return {
            "area_m2": None,
            "perimeter_m": None,
            "road_width_m": None,
            "vertices_ground": [],
            "calibrated": False,
            "is_valid": False,
            "error": f"Failed to compute ground geometry: {e}"
        }
