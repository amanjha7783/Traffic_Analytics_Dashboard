"""
Detection and Tracking Pipeline Integration.
Wraps YOLOv8Detector and MultiVehicleTracker for sequential frame processing.
Performs ground-plane projection using committed homography to compute physical velocity (km/h)
and evaluates virtual gate crossings and region occupancy.
"""
from typing import Dict, Any, List, Optional, Tuple, Sequence
import math
import numpy as np
import cv2
import logging

from app.vision.detector import YOLOv8Detector, Detection
from app.vision.tracker import VehicleTracker, TrackedVehicle
from app.video_intelligence.homography import transform_image_to_ground
from app.video_intelligence.geospatial import utm_to_wgs84, wgs84_to_utm

logger = logging.getLogger(__name__)


class VideoIntelligencePipeline:
    def __init__(
        self,
        confidence_threshold: float = 0.35,
        iou_threshold: float = 0.45,
        homography_matrix: Optional[Sequence[Sequence[float]]] = None,
        project_coords: Optional[Tuple[float, float]] = None, # (lat, lon)
        project_utm_zone: Optional[int] = None,
        counting_gates: Optional[List[Dict[str, Any]]] = None,
        measurement_regions: Optional[List[Dict[str, Any]]] = None,
    ):
        self.detector = YOLOv8Detector(
            conf_threshold=confidence_threshold,
            iou_threshold=iou_threshold
        )
        self.tracker = VehicleTracker(
            max_age=30,
            min_hits=3,
            iou_threshold=iou_threshold
        )
        self.homography = homography_matrix
        self.project_coords = project_coords
        self.project_utm_zone = project_utm_zone
        self.counting_gates = counting_gates or []
        self.measurement_regions = measurement_regions or []

        # Reference origin UTM in meters for absolute geospatial coordinates
        self.origin_easting = 0.0
        self.origin_northing = 0.0
        if project_coords:
            lat, lon = project_coords
            e, n, z, _ = wgs84_to_utm(lat, lon, forced_zone=project_utm_zone)
            self.origin_easting = e
            self.origin_northing = n
            self.project_utm_zone = z

        # Gate crossing state: track_id -> set of gate_ids crossed
        self.crossed_gates: Dict[int, set] = {}
        # Ground coordinate trajectory state for physical speed: track_id -> state dict
        self.track_ground_history: Dict[int, Dict[str, Any]] = {}

    def process_frame(
        self,
        frame: np.ndarray,
        frame_idx: int,
        timestamp_s: float
    ) -> Dict[str, Any]:
        """
        Process a single video frame:
        1. YOLOv8 object detection & class mapping
        2. Kalman Filter + IoU multi-object tracking
        3. Homography ground projection (X, Y meters, speed km/h, lat/lon)
        4. Gate crossing & region containment check
        """
        # Run detection
        detections = self.detector.detect(frame)

        # Update tracker
        tracks = self.tracker.update(detections, timestamp_s)

        frame_observations = []
        active_vehicles_in_regions: Dict[str, List[Dict[str, Any]]] = {
            r["id"]: [] for r in self.measurement_regions
        }

        for track in tracks:
            bbox = track.bbox # (x1, y1, x2, y2)
            cx = (bbox[0] + bbox[2]) / 2.0
            cy = float(bbox[3]) # bottom-center represents ground contact point

            ground_x = None
            ground_y = None
            lat = None
            lon = None
            speed_kmh = None

            if self.homography:
                try:
                    gx, gy = transform_image_to_ground((cx, cy), self.homography)
                    ground_x = round(gx, 3)
                    ground_y = round(gy, 3)

                    # Compute physical speed from ground trajectory displacement
                    hist = self.track_ground_history.get(track.track_id)
                    if hist is not None:
                        dt = timestamp_s - hist["prev_ts"]
                        if dt > 0.001:
                            disp_m = math.hypot(gx - hist["prev_gx"], gy - hist["prev_gy"])
                            if disp_m < 0.08:
                                raw_spd = 0.0
                            else:
                                raw_spd = (disp_m / dt) * 3.6

                            prev_spd = hist.get("smoothed_speed")
                            smoothed_spd = raw_spd if prev_spd is None else 0.7 * prev_spd + 0.3 * raw_spd

                            if track.class_name == "PEDESTRIAN":
                                speed_kmh = None if smoothed_spd > 25.0 else round(smoothed_spd, 1)
                            elif smoothed_spd > 160.0:
                                speed_kmh = None
                            else:
                                speed_kmh = round(smoothed_spd, 1)

                            hist["smoothed_speed"] = smoothed_spd
                            hist["prev_gx"] = gx
                            hist["prev_gy"] = gy
                            hist["prev_ts"] = timestamp_s
                    else:
                        self.track_ground_history[track.track_id] = {
                            "prev_gx": gx,
                            "prev_gy": gy,
                            "prev_ts": timestamp_s,
                            "smoothed_speed": None,
                        }

                    # Geographic WGS84 coordinates
                    if self.origin_easting > 0 and self.project_utm_zone:
                        abs_easting = self.origin_easting + gx
                        abs_northing = self.origin_northing + gy
                        lat_val, lon_val = utm_to_wgs84(
                            abs_easting, abs_northing, self.project_utm_zone, northern_hemisphere=True
                        )
                        lat = round(lat_val, 7)
                        lon = round(lon_val, 7)
                except Exception as err:
                    logger.debug(f"Homography ground mapping error: {err}")

            obs = {
                "track_id": track.track_id,
                "frame_idx": frame_idx,
                "timestamp_s": round(timestamp_s, 3),
                "vehicle_class": track.class_name,
                "confidence": round(float(track.confidence), 3),
                "bbox": [int(v) for v in bbox],
                "image_x": round(cx, 1),
                "image_y": round(cy, 1),
                "ground_x_m": ground_x,
                "ground_y_m": ground_y,
                "latitude": lat,
                "longitude": lon,
                "speed_kmh": speed_kmh,
                "direction": getattr(track, "direction", "Forward"),
            }
            frame_observations.append(obs)

            # Check region containment (using pointPolygonTest)
            for r in self.measurement_regions:
                poly_pts = np.asarray(r.get("vertices_pixel", []), dtype=np.int32)
                if len(poly_pts) >= 3:
                    if cv2.pointPolygonTest(poly_pts, (cx, cy), False) >= 0:
                        active_vehicles_in_regions[r["id"]].append(obs)

            # Check counting line crossing
            if len(track.trajectory) >= 2:
                p1 = (track.trajectory[-2][0], track.trajectory[-2][1])
                p2 = (track.trajectory[-1][0], track.trajectory[-1][1])
                for gate in self.counting_gates:
                    gate_id = gate.get("id", "gate-1")
                    if track.track_id not in self.crossed_gates:
                        self.crossed_gates[track.track_id] = set()

                    if gate_id not in self.crossed_gates[track.track_id]:
                        line = gate.get("line") # [[x1,y1], [x2,y2]]
                        if line and len(line) == 2:
                            if lines_intersect(p1, p2, line[0], line[1]):
                                self.crossed_gates[track.track_id].add(gate_id)

        return {
            "frame_idx": frame_idx,
            "timestamp_s": timestamp_s,
            "observations": frame_observations,
            "active_tracks_count": len(tracks),
            "region_occupancies": {
                r_id: len(veh_list) for r_id, veh_list in active_vehicles_in_regions.items()
            },
            "gate_crossings_count": sum(len(gates) for gates in self.crossed_gates.values()),
        }


def lines_intersect(p1, p2, p3, p4) -> bool:
    """Check whether line segment p1-p2 intersects line segment p3-p4."""
    def ccw(a, b, c):
        return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])
    return ccw(p1, p3, p4) != ccw(p2, p3, p4) and ccw(p1, p2, p3) != ccw(p1, p2, p4)
