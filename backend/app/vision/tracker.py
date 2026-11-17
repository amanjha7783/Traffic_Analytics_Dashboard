"""
Multi-Object Vehicle Tracker with Kalman Filter and IoU Association.
Maintains persistent track IDs, manages track lifecycle, and prevents duplicate counting.
"""
import numpy as np
import cv2
import logging
from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


def calculate_iou(boxA: Tuple[int, int, int, int], boxB: Tuple[int, int, int, int]) -> float:
    """Calculate Intersection over Union (IoU) of two bounding boxes (x1, y1, x2, y2)."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    inter_width = max(0, xB - xA)
    inter_height = max(0, yB - yA)
    inter_area = inter_width * inter_height

    boxA_area = max(1, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    boxB_area = max(1, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

    union_area = float(boxA_area + boxB_area - inter_area)
    if union_area <= 0:
        return 0.0

    return inter_area / union_area


class KalmanBoxTracker:
    """
    Kalman Filter for tracking bounding boxes in image space [cx, cy, s, r]
    where s is scale (area) and r is aspect ratio.
    """
    count = 1000  # Start IDs from 1000 for clear 4-digit formatting (e.g. 4732)

    def __init__(
        self,
        bbox: Tuple[int, int, int, int],
        class_name: str,
        timestamp: float = 0.0,
        confidence: float = 0.0,
    ):
        # Initialize OpenCV Kalman Filter (7 state variables, 4 measurement variables)
        self.kf = cv2.KalmanFilter(7, 4)
        self.kf.measurementMatrix = np.array([
            [1, 0, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0]
        ], np.float32)

        self.kf.transitionMatrix = np.array([
            [1, 0, 0, 0, 1, 0, 0],
            [0, 1, 0, 0, 0, 1, 0],
            [0, 0, 1, 0, 0, 0, 1],
            [0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 1]
        ], np.float32)

        self.kf.processNoiseCov = np.eye(7, dtype=np.float32) * 1e-2
        self.kf.processNoiseCov[4:, 4:] *= 5.0
        self.kf.measurementNoiseCov = np.eye(4, dtype=np.float32) * 1e-1
        self.kf.errorCovPost = np.eye(7, dtype=np.float32) * 1.0

        state = self._bbox_to_z(bbox)
        self.kf.statePost = np.vstack((state, np.zeros((3, 1), dtype=np.float32)))

        self.time_since_update = 0
        KalmanBoxTracker.count += 1
        self.id = KalmanBoxTracker.count
        self.class_name = class_name
        self.history = []
        self.hits = 1
        self.hit_streak = 1
        self.age = 0
        self.first_seen = timestamp
        self.last_seen = timestamp
        self.confidence = confidence
        self.confidence_sum = confidence
        self.trajectory: List[Tuple[float, float, float]] = []  # (cx, cy, timestamp)
        self.has_crossed_counting_line = False
        self.speed_px_per_sec = 0.0

        cx, cy = (bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0
        self.trajectory.append((cx, cy, timestamp))

    def _bbox_to_z(self, bbox: Tuple[int, int, int, int]) -> np.ndarray:
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        x = bbox[0] + w / 2.0
        y = bbox[1] + h / 2.0
        s = w * h  # scale is area
        r = w / float(h) if h > 0 else 1.0
        return np.array([x, y, s, r], dtype=np.float32).reshape(4, 1)

    def _x_to_bbox(self, x: np.ndarray) -> Tuple[int, int, int, int]:
        state = np.asarray(x, dtype=np.float32).reshape(-1)
        w = float(np.sqrt(max(1.0, state[2] * state[3])))
        h = max(1.0, float(state[2]) / w if w > 0 else 1.0)
        x1 = int(round(float(state[0]) - w / 2.0))
        y1 = int(round(float(state[1]) - h / 2.0))
        x2 = int(round(float(state[0]) + w / 2.0))
        y2 = int(round(float(state[1]) + h / 2.0))
        return (x1, y1, x2, y2)

    def predict(self) -> Tuple[int, int, int, int]:
        if (self.kf.statePost[6] + self.kf.statePost[2]) <= 0:
            self.kf.statePost[6] *= 0.0

        self.kf.predict()
        self.age += 1
        if self.time_since_update > 0:
            self.hit_streak = 0
        self.time_since_update += 1

        pred_box = self._x_to_bbox(self.kf.statePost[:4])
        self.history.append(pred_box)
        return pred_box

    def update(
        self,
        bbox: Tuple[int, int, int, int],
        class_name: str,
        timestamp: float = 0.0,
        confidence: float = 0.0,
    ):
        self.time_since_update = 0
        self.history = []
        self.hits += 1
        self.hit_streak += 1
        self.class_name = class_name
        self.last_seen = timestamp
        self.confidence = confidence
        self.confidence_sum += confidence

        z = self._bbox_to_z(bbox)
        self.kf.correct(z)

        # Update trajectory and calculate speed
        cx, cy = (bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0
        if len(self.trajectory) > 0 and timestamp > self.trajectory[-1][2]:
            prev_cx, prev_cy, prev_t = self.trajectory[-1]
            dt = timestamp - prev_t
            if dt > 0:
                dist_px = np.sqrt((cx - prev_cx) ** 2 + (cy - prev_cy) ** 2)
                instant_speed = dist_px / dt
                # Smooth speed
                self.speed_px_per_sec = 0.7 * self.speed_px_per_sec + 0.3 * instant_speed

        self.trajectory.append((cx, cy, timestamp))
        if len(self.trajectory) > 50:
            self.trajectory.pop(0)

    def get_state(self) -> Tuple[int, int, int, int]:
        return self._x_to_bbox(self.kf.statePost[:4])


@dataclass
class TrackedVehicle:
    track_id: int
    class_name: str
    bbox: Tuple[int, int, int, int]
    center: Tuple[float, float]
    speed_px_per_sec: float
    has_crossed_counting_line: bool
    trajectory: List[Tuple[float, float, float]]
    color_bgr: Tuple[int, int, int]
    confidence: float
    first_seen: float
    last_seen: float
    frames_seen: int


class VehicleTracker:
    def __init__(self, max_age: int = 30, min_hits: int = 3, iou_threshold: float = 0.3):
        self.max_age = max_age
        self.min_hits = min_hits
        self.iou_threshold = iou_threshold
        self.trackers: List[KalmanBoxTracker] = []
        self.total_created = 0
        self.total_confirmed = 0

    def reset(self):
        """Clear all tracks before a new, independent video-processing session."""
        self.trackers.clear()
        self.total_created = 0
        self.total_confirmed = 0

    def update(self, detections: List[Any], timestamp: float = 0.0) -> List[TrackedVehicle]:
        """
        Process detections for current frame and return active confirmed tracked vehicles.
        detections: list of Detection objects (with bbox, class_name, etc.)
        """
        # 1. Predict new locations of existing trackers
        for trk in self.trackers:
            trk.predict()

        # 2. Compute IoU cost matrix between existing trackers and new detections
        num_trackers = len(self.trackers)
        num_detections = len(detections)

        matched_trks = set()
        matched_dets = set()
        matches = []

        if num_trackers > 0 and num_detections > 0:
            iou_matrix = np.zeros((num_trackers, num_detections), dtype=np.float32)
            for t_idx, trk in enumerate(self.trackers):
                trk_box = trk.get_state()
                for d_idx, det in enumerate(detections):
                    if trk.class_name == det.class_name:
                        iou_matrix[t_idx, d_idx] = calculate_iou(trk_box, det.bbox)

            # Greedy matching in descending order of IoU
            flat_indices = np.argsort(-iou_matrix.ravel())
            for idx in flat_indices:
                t_idx = idx // num_detections
                d_idx = idx % num_detections

                if iou_matrix[t_idx, d_idx] < self.iou_threshold:
                    break

                if t_idx in matched_trks or d_idx in matched_dets:
                    continue

                matched_trks.add(t_idx)
                matched_dets.add(d_idx)
                matches.append((t_idx, d_idx))

        # 3. Update matched trackers
        for t_idx, d_idx in matches:
            det = detections[d_idx]
            self.trackers[t_idx].update(
                det.bbox, det.class_name, timestamp, det.confidence
            )

        # 4. Create new trackers for unmatched detections
        for d_idx in range(num_detections):
            if d_idx not in matched_dets:
                det = detections[d_idx]
                trk = KalmanBoxTracker(
                    det.bbox, det.class_name, timestamp, det.confidence
                )
                self.trackers.append(trk)
                self.total_created += 1

        # 5. Remove dead trackers
        alive_trackers = []
        for trk in self.trackers:
            if trk.time_since_update <= self.max_age:
                alive_trackers.append(trk)
        self.trackers = alive_trackers

        # 6. Extract confirmed tracks to return
        results: List[TrackedVehicle] = []
        for trk in self.trackers:
            # Active and confirmed
            if trk.hits >= self.min_hits and trk.time_since_update == 0:
                if trk.hits == self.min_hits:
                    self.total_confirmed += 1
                box = trk.get_state()
                cx = (box[0] + box[2]) / 2.0
                cy = (box[1] + box[3]) / 2.0
                
                # Fetch BGR color from classifier reference
                from app.vision.vehicle_classifier import get_vehicle_spec
                spec = get_vehicle_spec(trk.class_name)

                results.append(
                    TrackedVehicle(
                        track_id=trk.id,
                        class_name=trk.class_name,
                        bbox=box,
                        center=(cx, cy),
                        speed_px_per_sec=round(trk.speed_px_per_sec, 1),
                        has_crossed_counting_line=trk.has_crossed_counting_line,
                        trajectory=list(trk.trajectory),
                        color_bgr=spec["color_bgr"],
                        confidence=trk.confidence,
                        first_seen=trk.first_seen,
                        last_seen=trk.last_seen,
                        frames_seen=trk.hits,
                    )
                )

        return results

    def mark_counted(self, track_id: int):
        """Mark a track as having crossed the counting line (prevents re-counting)."""
        for trk in self.trackers:
            if trk.id == track_id:
                trk.has_crossed_counting_line = True
                break
