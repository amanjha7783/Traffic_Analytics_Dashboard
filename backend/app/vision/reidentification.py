"""
Cross-Camera Vehicle Re-Identification Module.
Associates vehicles across Camera A (upstream junction) and Camera B (downstream junction)
using HSV color histogram embeddings and spatio-temporal travel time constraints.
"""
import cv2
import numpy as np
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class VehicleSighting:
    camera_id: str
    track_id: int
    class_name: str
    timestamp: float           # Relative seconds or Unix epoch
    datetime_str: str
    bbox: Tuple[int, int, int, int]
    histogram: np.ndarray      # Normalized 3D HSV histogram feature vector


class CrossCameraReidentifier:
    def __init__(
        self,
        corridor_length_m: float = 1200.0,
        min_speed_kmh: float = 10.0,
        max_speed_kmh: float = 100.0,
        similarity_threshold: float = 0.65
    ):
        self.corridor_length_m = corridor_length_m
        self.min_speed_kmh = min_speed_kmh
        self.max_speed_kmh = max_speed_kmh
        self.similarity_threshold = similarity_threshold

        # Min and max travel time allowed (seconds)
        self.min_travel_time_s = (self.corridor_length_m / (self.max_speed_kmh / 3.6)) if self.max_speed_kmh > 0 else 5.0
        self.max_travel_time_s = (self.corridor_length_m / (self.min_speed_kmh / 3.6)) if self.min_speed_kmh > 0 else 600.0

        # Memory buffer of sightings from Camera A (waiting for Cam B arrival)
        self.camera_a_sightings: List[VehicleSighting] = []

    def extract_color_histogram(self, crop: np.ndarray) -> Optional[np.ndarray]:
        """Extract a normalized 3D HSV histogram (16x8x8 = 1024 bins) from vehicle crop."""
        if crop is None or crop.size == 0 or crop.shape[0] < 10 or crop.shape[1] < 10:
            return None

        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1, 2], None, [16, 8, 8], [0, 180, 0, 256, 0, 256])
        cv2.normalize(hist, hist)
        return hist.flatten()

    def record_sighting_cam_a(
        self,
        track_id: int,
        class_name: str,
        timestamp: float,
        bbox: Tuple[int, int, int, int],
        frame: np.ndarray
    ) -> Optional[VehicleSighting]:
        """Record a vehicle departure from Camera A."""
        x1, y1, x2, y2 = bbox
        crop = frame[max(0, y1):min(frame.shape[0], y2), max(0, x1):min(frame.shape[1], x2)]
        hist = self.extract_color_histogram(crop)
        if hist is None:
            return None

        sighting = VehicleSighting(
            camera_id="cam-a",
            track_id=track_id,
            class_name=class_name,
            timestamp=timestamp,
            datetime_str=datetime.now().isoformat(),
            bbox=bbox,
            histogram=hist
        )
        self.camera_a_sightings.append(sighting)

        # Clean up stale sightings older than 2 * max_travel_time
        cutoff = timestamp - (2 * self.max_travel_time_s)
        self.camera_a_sightings = [s for s in self.camera_a_sightings if s.timestamp >= cutoff]
        return sighting

    def match_sighting_cam_b(
        self,
        track_id: int,
        class_name: str,
        timestamp: float,
        bbox: Tuple[int, int, int, int],
        frame: np.ndarray
    ) -> Optional[Dict[str, Any]]:
        """
        Check if vehicle arriving at Camera B matches any vehicle previously observed at Camera A.
        Returns match metadata if a valid match is found within spatio-temporal constraints.
        """
        x1, y1, x2, y2 = bbox
        crop = frame[max(0, y1):min(frame.shape[0], y2), max(0, x1):min(frame.shape[1], x2)]
        b_hist = self.extract_color_histogram(crop)
        if b_hist is None:
            return None

        best_match: Optional[VehicleSighting] = None
        best_score = -1.0

        for a_sighting in self.camera_a_sightings:
            # 1. Class must be identical
            if a_sighting.class_name != class_name:
                continue

            # 2. Spatio-temporal travel window constraint
            travel_time = timestamp - a_sighting.timestamp
            if not (self.min_travel_time_s <= travel_time <= self.max_travel_time_s):
                continue

            # 3. Histogram correlation similarity
            # cv2.HISTCMP_CORREL ranges from -1 to 1 (1 = identical)
            score = cv2.compareHist(
                a_sighting.histogram.reshape(16, 8, 8),
                b_hist.reshape(16, 8, 8),
                cv2.HISTCMP_CORREL
            )

            if score > self.similarity_threshold and score > best_score:
                best_score = score
                best_match = a_sighting

        if best_match is not None:
            travel_time_s = timestamp - best_match.timestamp
            speed_kmh = (self.corridor_length_m / travel_time_s) * 3.6 if travel_time_s > 0 else 0.0

            # Remove matched sighting so it cannot be matched twice
            self.camera_a_sightings.remove(best_match)

            match_result = {
                "matched": True,
                "camera_a_track_id": best_match.track_id,
                "camera_b_track_id": track_id,
                "vehicle_class": class_name,
                "entry_time": best_match.timestamp,
                "exit_time": timestamp,
                "travel_time_seconds": round(travel_time_s, 2),
                "speed_kmh": round(speed_kmh, 1),
                "corridor_length_m": self.corridor_length_m,
                "reid_confidence": round(best_score, 3)
            }
            logger.info(f"Cross-camera match: Track {best_match.track_id} -> {track_id} ({class_name}), "
                        f"travel_time={travel_time_s:.1f}s, speed={speed_kmh:.1f}km/h, conf={best_score:.2f}")
            return match_result

        return None
