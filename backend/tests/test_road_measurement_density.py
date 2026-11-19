import pytest
import numpy as np
import cv2
from shapely.geometry import Polygon

from app.video_intelligence.area_calculator import measure_region_geometry
from app.video_intelligence.homography import compute_robust_homography
from app.video_intelligence.geospatial import wgs84_to_utm


def test_measure_region_geometry_valid_quad():
    """Verify valid polygon computes correct real-world area and perimeter via homography."""
    # 4 image points and 4 ground points forming a 50m x 40m rectangle
    img_pts = [[0, 0], [100, 0], [100, 100], [0, 100]]
    ground_pts = [[0.0, 0.0], [50.0, 0.0], [50.0, 40.0], [0.0, 40.0]]

    h_res = compute_robust_homography(img_pts, ground_pts)
    h_matrix = h_res["homography_matrix"]

    poly_px = [[0, 0], [100, 0], [100, 100], [0, 100]]
    metrics = measure_region_geometry(poly_px, h_matrix)

    assert metrics["is_valid"] is True
    assert metrics["calibrated"] is True
    assert metrics["area_m2"] is not None
    assert abs(metrics["area_m2"] - 2000.0) < 1.0  # 50m * 40m = 2000m²
    assert abs(metrics["perimeter_m"] - 180.0) < 1.0  # 2 * (50 + 40) = 180m


def test_measure_region_geometry_self_intersecting():
    """Verify self-intersecting polygon is detected and rejected."""
    # Bowtie self-intersecting polygon
    bowtie_px = [[0, 0], [100, 100], [100, 0], [0, 100]]
    img_pts = [[0, 0], [100, 0], [100, 100], [0, 100]]
    ground_pts = [[0.0, 0.0], [50.0, 0.0], [50.0, 40.0], [0.0, 40.0]]
    h_matrix = compute_robust_homography(img_pts, ground_pts)["homography_matrix"]

    metrics = measure_region_geometry(bowtie_px, h_matrix)
    assert metrics["is_valid"] is False
    assert "Invalid polygon topology" in metrics.get("error", "")


def test_measure_region_geometry_less_than_three_points():
    """Verify fewer than 3 points is rejected."""
    metrics = measure_region_geometry([[10, 10], [20, 20]], None)
    assert metrics["is_valid"] is False
    assert "at least 3" in metrics.get("error", "")


def test_point_in_polygon_containment():
    """Verify cv2.pointPolygonTest accurately identifies points inside vs outside road polygon."""
    poly_px = np.array([[100, 100], [500, 100], [500, 400], [100, 400]], dtype=np.int32)

    # Point clearly inside
    inside_pt = (300, 250)
    assert cv2.pointPolygonTest(poly_px, inside_pt, False) >= 0

    # Point clearly outside
    outside_pt = (50, 50)
    assert cv2.pointPolygonTest(poly_px, outside_pt, False) < 0

    # Point on boundary
    boundary_pt = (100, 250)
    assert cv2.pointPolygonTest(poly_px, boundary_pt, False) >= 0
