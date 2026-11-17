from typing import Optional, Sequence

import cv2
import numpy as np


def compute_homography(
    image_points: Sequence[Sequence[float]],
    ground_points_m: Sequence[Sequence[float]],
) -> tuple[list[list[float]], float]:
    if len(image_points) < 4 or len(image_points) != len(ground_points_m):
        raise ValueError("At least four paired image and road-plane points are required")
    image = np.asarray(image_points, dtype=np.float64)
    ground = np.asarray(ground_points_m, dtype=np.float64)
    if image.shape != (len(image_points), 2) or ground.shape != (len(ground_points_m), 2):
        raise ValueError("Calibration points must be finite x/y coordinate pairs")
    if not np.isfinite(image).all() or not np.isfinite(ground).all():
        raise ValueError("Calibration coordinates must be finite")
    matrix, mask = cv2.findHomography(image, ground, cv2.RANSAC, 3.0)
    if matrix is None or mask is None or int(mask.sum()) < 4:
        raise ValueError("Calibration points do not define a stable road-plane homography")
    projected = cv2.perspectiveTransform(image.reshape(-1, 1, 2), matrix).reshape(-1, 2)
    residuals = np.linalg.norm(projected - ground, axis=1)
    inlier_residuals = residuals[mask.ravel().astype(bool)]
    return matrix.tolist(), float(np.sqrt(np.mean(inlier_residuals ** 2)))


def image_point_to_ground(
    point: Sequence[float],
    homography: Sequence[Sequence[float]],
) -> tuple[float, float]:
    matrix = np.asarray(homography, dtype=np.float64)
    if matrix.shape != (3, 3) or not np.isfinite(matrix).all():
        raise ValueError("Homography must be a finite 3x3 matrix")
    projected = cv2.perspectiveTransform(
        np.asarray(point, dtype=np.float64).reshape(1, 1, 2), matrix
    )[0, 0]
    return float(projected[0]), float(projected[1])


def vehicle_footprint(
    bbox: Sequence[float],
    homography: Optional[Sequence[Sequence[float]]],
    length_m: Optional[float] = None,
    width_m: Optional[float] = None,
    image_motion_vector: Optional[Sequence[float]] = None,
) -> Optional[list[tuple[float, float]]]:
    if homography is None or length_m is None or width_m is None or image_motion_vector is None:
        return None
    if len(bbox) != 4:
        raise ValueError("Bounding box must contain x1, y1, x2, y2")
    if length_m <= 0 or width_m <= 0 or len(image_motion_vector) != 2:
        raise ValueError("Vehicle dimensions and motion vector must be valid")
    x1, y1, x2, y2 = (float(value) for value in bbox)
    if x2 <= x1 or y2 <= y1:
        raise ValueError("Bounding box coordinates are invalid")
    motion_x, motion_y = (float(value) for value in image_motion_vector)
    if abs(motion_x) + abs(motion_y) < 1e-6:
        return None
    center_image = ((x1 + x2) / 2, y2)
    center_ground = np.asarray(image_point_to_ground(center_image, homography))
    motion_ground = np.asarray(
        image_point_to_ground((center_image[0] + motion_x, center_image[1] + motion_y), homography)
    ) - center_ground
    magnitude = float(np.linalg.norm(motion_ground))
    if magnitude < 1e-6:
        return None
    longitudinal = motion_ground / magnitude
    lateral = np.asarray([-longitudinal[1], longitudinal[0]])
    half_length = length_m / 2
    half_width = width_m / 2
    return [
        tuple(center_ground - longitudinal * half_length - lateral * half_width),
        tuple(center_ground + longitudinal * half_length - lateral * half_width),
        tuple(center_ground + longitudinal * half_length + lateral * half_width),
        tuple(center_ground - longitudinal * half_length + lateral * half_width),
    ]
