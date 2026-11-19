"""
Annotated Video Rendering Engine.
Draws bounding boxes, persistent track IDs, vehicle taxonomy labels,
calibrated speed indicators (km/h), virtual counting gates, and monitored region overlays.
"""
from typing import Dict, Any, List, Optional, Sequence, Tuple
import cv2
import numpy as np

# BGR color palette for vehicle classes
CLASS_COLORS_BGR = {
    "TWO-WHEELER": (255, 140, 0),      # Vivid Blue/Orange
    "THREE-WHEELER": (0, 215, 255),    # Golden Amber
    "FOUR-WHEELER": (255, 80, 50),     # Ocean Blue
    "BUS": (147, 20, 255),             # Rich Purple
    "TRUCK": (80, 80, 240),            # Crimson Red
    "BICYCLE": (80, 220, 100),         # Signal Green
    "PEDESTRIAN": (220, 220, 220),     # Silver
    "OTHER": (180, 180, 180),
}


def draw_frame_annotations(
    frame: np.ndarray,
    observations: Sequence[Dict[str, Any]],
    counting_gates: Optional[List[Dict[str, Any]]] = None,
    measurement_regions: Optional[List[Dict[str, Any]]] = None,
    timestamp_s: float = 0.0,
    show_speed: bool = True,
    show_boxes: bool = True,
    show_regions: bool = True,
) -> np.ndarray:
    """Render analytical overlays directly onto the video frame."""
    annotated = frame.copy()
    h, w = annotated.shape[:2]

    # 1. Draw Regions
    if show_regions and measurement_regions:
        overlay = annotated.copy()
        for r in measurement_regions:
            pts = np.asarray(r.get("vertices_pixel", []), dtype=np.int32)
            if len(pts) >= 3:
                cv2.fillPoly(overlay, [pts], (49, 91, 138)) # Translucent navy
                cv2.polylines(annotated, [pts], True, (200, 150, 50), 2, cv2.LINE_AA)
                # Label
                cx = int(np.mean(pts[:, 0]))
                cy = int(np.mean(pts[:, 1]))
                label = r.get("name", "Region")
                cv2.putText(annotated, label, (cx - 30, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2, cv2.LINE_AA)
                cv2.putText(annotated, label, (cx - 30, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (30, 30, 30), 1, cv2.LINE_AA)
        cv2.addWeighted(overlay, 0.25, annotated, 0.75, 0, annotated)

    # 2. Draw Counting Gates
    if counting_gates:
        for gate in counting_gates:
            line = gate.get("line") # [[x1, y1], [x2, y2]]
            if line and len(line) == 2:
                pt1 = (int(line[0][0]), int(line[0][1]))
                pt2 = (int(line[1][0]), int(line[1][1]))
                cv2.line(annotated, pt1, pt2, (0, 200, 255), 3, cv2.LINE_AA)
                cv2.circle(annotated, pt1, 5, (0, 200, 255), -1)
                cv2.circle(annotated, pt2, 5, (0, 200, 255), -1)

    # 3. Draw Vehicle Detections and Tracks
    if show_boxes:
        for obs in observations:
            bbox = obs["bbox"] # [x1, y1, x2, y2]
            x1, y1, x2, y2 = bbox
            v_class = obs.get("vehicle_class", "OTHER")
            track_id = obs.get("track_id", 0)
            color = CLASS_COLORS_BGR.get(v_class, (200, 200, 200))

            # Bounding box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2, cv2.LINE_AA)

            # Header tag
            speed_str = f" {obs['speed_kmh']} km/h" if show_speed and obs.get("speed_kmh") else ""
            tag = f"#{track_id} {v_class}{speed_str}"

            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.45
            thickness = 1
            (text_w, text_h), baseline = cv2.getTextSize(tag, font, font_scale, thickness)

            tag_y1 = max(0, y1 - text_h - 6)
            tag_y2 = y1
            cv2.rectangle(annotated, (x1, tag_y1), (x1 + text_w + 8, tag_y2), color, -1)
            cv2.putText(annotated, tag, (x1 + 4, tag_y2 - 3), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

    # 4. Top Telemetry HUD
    hud_bg = (23, 34, 49) # SCADA dark slate
    cv2.rectangle(annotated, (0, 0), (w, 28), hud_bg, -1)
    hud_text = f"TrafficOps Studio | Time: {timestamp_s:.2f}s | Active Tracks: {len(observations)}"
    cv2.putText(annotated, hud_text, (12, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (232, 237, 244), 1, cv2.LINE_AA)

    return annotated
