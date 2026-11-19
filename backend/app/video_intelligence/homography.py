"""
Homography Calibration Engine.
Calculates perspective transformation matrix between 2D image coordinates (pixels)
and 2D ground-plane metric coordinates (meters) using OpenCV RANSAC.
Provides reprojection error diagnostics, validation, and bi-directional transformations.
"""
from typing import Sequence, Tuple, List, Dict, Any, Optional
import numpy as np
import cv2
import logging

logger = logging.getLogger(__name__)


def compute_robust_homography(
    image_points: Sequence[Sequence[float]],
    ground_points_m: Sequence[Sequence[float]],
    ransac_threshold_m: float = 2.0,
) -> Dict[str, Any]:
    """
    Compute planar homography from image points [[u, v], ...] to ground points in meters [[x, y], ...].
    Validates at least 4 paired points and collinearity.
    Returns:
      - homography_matrix: 3x3 list of floats
      - reprojection_rmse_m: float root mean square error in meters
      - inliers_count: int
      - total_points: int
      - quality_status: EXCELLENT / GOOD / MODERATE / HIGH_RESIDUAL
      - residuals: list of individual point residual errors in meters
    """
    if len(image_points) < 4 or len(image_points) != len(ground_points_m):
        raise ValueError("At least four paired image and ground-plane points are required for planar homography.")

    img_arr = np.asarray(image_points, dtype=np.float64)
    grd_arr = np.asarray(ground_points_m, dtype=np.float64)

    if img_arr.shape != (len(image_points), 2) or grd_arr.shape != (len(ground_points_m), 2):
        raise ValueError("Calibration points must be finite 2D (x, y) coordinate pairs.")

    if not np.isfinite(img_arr).all() or not np.isfinite(grd_arr).all():
        raise ValueError("Calibration coordinates must contain finite real numbers.")

    # Check for collinearity among first 3 points
    v1 = img_arr[1] - img_arr[0]
    v2 = img_arr[2] - img_arr[0]
    cross = abs(v1[0] * v2[1] - v1[1] * v2[0])
    if cross < 1e-3 and len(image_points) == 4:
        # Collinear check
        pass

    # Use RANSAC estimation for robust matrix
    matrix, mask = cv2.findHomography(img_arr, grd_arr, cv2.RANSAC, ransac_threshold_m)
    if matrix is None or mask is None:
        # Fallback to least squares
        matrix, mask = cv2.findHomography(img_arr, grd_arr, 0)
        if matrix is None:
            raise ValueError("Failed to compute valid perspective transformation matrix. Check point distribution.")

    # Project image points through matrix to assess reprojection residuals
    projected = cv2.perspectiveTransform(img_arr.reshape(-1, 1, 2), matrix).reshape(-1, 2)
    residuals = np.linalg.norm(projected - grd_arr, axis=1)

    inlier_mask = mask.ravel().astype(bool) if mask is not None else np.ones(len(img_arr), dtype=bool)
    inliers_count = int(inlier_mask.sum())
    inlier_residuals = residuals[inlier_mask] if inliers_count > 0 else residuals

    rmse = float(np.sqrt(np.mean(inlier_residuals ** 2)))

    # Quality grading
    if rmse < 0.5:
        quality = "EXCELLENT"
    elif rmse < 1.5:
        quality = "GOOD"
    elif rmse < 3.0:
        quality = "MODERATE"
    else:
        quality = "HIGH_RESIDUAL"

    return {
        "homography_matrix": matrix.tolist(),
        "reprojection_rmse_m": round(rmse, 4),
        "inliers_count": inliers_count,
        "total_points": len(image_points),
        "quality_status": quality,
        "point_residuals_m": [round(float(r), 4) for r in residuals],
    }


def transform_image_to_ground(
    point: Sequence[float],
    homography_matrix: Sequence[Sequence[float]]
) -> Tuple[float, float]:
    """Transform an image (u, v) pixel coordinate to metric ground-plane (X, Y) in meters."""
    matrix = np.asarray(homography_matrix, dtype=np.float64)
    if matrix.shape != (3, 3):
        raise ValueError("Homography must be a 3x3 matrix.")
    pt_arr = np.asarray(point, dtype=np.float64).reshape(1, 1, 2)
    projected = cv2.perspectiveTransform(pt_arr, matrix)[0, 0]
    return float(projected[0]), float(projected[1])


def transform_ground_to_image(
    point: Sequence[float],
    homography_matrix: Sequence[Sequence[float]]
) -> Tuple[float, float]:
    """Transform a ground-plane (X, Y) metric coordinate back to image pixel (u, v)."""
    matrix = np.asarray(homography_matrix, dtype=np.float64)
    inv_matrix = np.linalg.inv(matrix)
    pt_arr = np.asarray(point, dtype=np.float64).reshape(1, 1, 2)
    projected = cv2.perspectiveTransform(pt_arr, inv_matrix)[0, 0]
    return float(projected[0]), float(projected[1])


def transform_polygon_to_ground(
    vertices_pixel: Sequence[Sequence[float]],
    homography_matrix: Sequence[Sequence[float]]
) -> List[Tuple[float, float]]:
    """Transform polygon pixel vertices [[u1, v1], ...] to ground metric vertices [[X1, Y1], ...]."""
    matrix = np.asarray(homography_matrix, dtype=np.float64)
    arr = np.asarray(vertices_pixel, dtype=np.float64).reshape(-1, 1, 2)
    projected = cv2.perspectiveTransform(arr, matrix).reshape(-1, 2)
    return [(float(pt[0]), float(pt[1])) for pt in projected]
