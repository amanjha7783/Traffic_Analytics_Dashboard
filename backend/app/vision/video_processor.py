"""Recorded-video detection, unique-track counting, annotation and exports."""

import csv
import json
import logging
import os
import subprocess
import threading
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

import cv2
import imageio_ffmpeg
import numpy as np

from app.config import OUTPUT_DIR, SUMMARY_DURATION_SECONDS
from app.database.database import save_video_minute_counts, save_video_tracks, update_video_session
from app.vision.detector import Detection, YOLOv8Detector
from app.vision.tracker import TrackedVehicle, VehicleTracker
from app.vision.vehicle_classifier import IRC_VEHICLE_SPECS, get_vehicle_spec

logger = logging.getLogger(__name__)


def _encode_browser_compatible_video(video_path: str) -> None:
    """Transcode OpenCV's MP4V output to broadly supported H.264 MP4."""
    temporary_path = os.path.join(
        os.path.dirname(video_path),
        f"{os.path.splitext(os.path.basename(video_path))[0]}.h264.mp4",
    )
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-y",
        "-i", video_path,
        "-map", "0:v:0",
        "-an",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        temporary_path,
    ]
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"Unable to encode browser-compatible video: {result.stderr[-2000:]}"
            )
        if not os.path.isfile(temporary_path) or os.path.getsize(temporary_path) == 0:
            raise RuntimeError("Video encoder produced an empty output file")

        validation = cv2.VideoCapture(temporary_path)
        try:
            if not validation.isOpened() or not validation.read()[0]:
                raise RuntimeError("Encoded H.264 video failed validation")
        finally:
            validation.release()

        os.replace(temporary_path, video_path)
    finally:
        if os.path.exists(temporary_path):
            os.remove(temporary_path)


CATEGORIES = (
    "TWO-WHEELER",
    "THREE-WHEELER",
    "FOUR-WHEELER",
    "BUS",
    "TRUCK",
    "BICYCLE",
    "OTHER",
    "PEDESTRIAN",
)


def _line_side(point: Tuple[float, float], a: Tuple[int, int], b: Tuple[int, int]) -> float:
    return (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])


def _crossed_line(
    previous: Tuple[float, float],
    current: Tuple[float, float],
    line: Tuple[Tuple[int, int], Tuple[int, int]],
) -> bool:
    a, b = line
    return (
        _line_side(previous, a, b) * _line_side(current, a, b) < 0
        and _line_side(a, previous, current) * _line_side(b, previous, current) < 0
    )


def _direction(
    previous: Tuple[float, float],
    current: Tuple[float, float],
    line: Tuple[Tuple[int, int], Tuple[int, int]],
) -> str:
    return "A_TO_B" if _line_side(previous, *line) < _line_side(current, *line) else "B_TO_A"


class VideoProcessor:
    def __init__(
        self,
        detector: Optional[YOLOv8Detector] = None,
        tracker: Optional[VehicleTracker] = None,
    ):
        self.detector = detector or YOLOv8Detector()
        self.tracker = tracker or VehicleTracker()

    def process_video(
        self,
        session_id: str,
        video_path: str,
        camera_id: str = "uploaded-video",
        counting_line: Optional[Tuple[Tuple[int, int], Tuple[int, int]]] = None,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        max_frames: Optional[int] = None,
        pause_event: Optional[threading.Event] = None,
        stop_event: Optional[threading.Event] = None,
    ) -> Dict[str, Any]:
        if not self.detector.is_ready():
            raise RuntimeError(self.detector.load_error or "Vehicle detection model is unavailable")
        if not os.path.isfile(video_path):
            raise FileNotFoundError("Recorded video file does not exist")

        self.tracker.reset()
        session_dir = os.path.join(str(OUTPUT_DIR), session_id)
        os.makedirs(session_dir, exist_ok=False)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError("Unable to decode the selected video")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if width <= 0 or height <= 0 or fps <= 0 or fps > 240 or frame_count <= 0:
            cap.release()
            raise ValueError("Video metadata is incomplete or invalid")
        frames_to_process = min(frame_count, max_frames) if max_frames else frame_count
        if counting_line is not None:
            for x, y in counting_line:
                if not (0 <= x < width and 0 <= y < height):
                    cap.release()
                    raise ValueError("Counting-line coordinates must be inside the video frame")

        output_video = os.path.join(session_dir, "annotated.mp4")
        writer = cv2.VideoWriter(
            output_video, cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height)
        )
        if not writer.isOpened():
            cap.release()
            raise RuntimeError("MP4V video encoder is unavailable on this system")

        counts = {category: 0 for category in CATEGORIES}
        tracks: Dict[int, Dict[str, Any]] = {}
        crossing_track_ids = set()
        minute_counts: Dict[int, Dict[str, int]] = {}
        raw_detections = 0
        processed_frames = 0
        started = time.monotonic()
        stopped = False

        try:
            update_video_session(session_id, status="PROCESSING")
            while processed_frames < frames_to_process:
                if stop_event and stop_event.is_set():
                    stopped = True
                    break
                while pause_event and pause_event.is_set():
                    if stop_event and stop_event.is_set():
                        stopped = True
                        break
                    time.sleep(0.1)
                if stopped:
                    break

                ok, frame = cap.read()
                if not ok or frame is None:
                    break
                processed_frames += 1
                timestamp_sec = (processed_frames - 1) / fps
                minute_counts.setdefault(
                    int(timestamp_sec // 60),
                    {name: 0 for name in CATEGORIES},
                )
                detections: List[Detection] = self.detector.detect(frame)
                raw_detections += len(detections)
                active_tracks = self.tracker.update(detections, timestamp=timestamp_sec)

                for track in active_tracks:
                    category = track.class_name if track.class_name in counts else "OTHER"
                    record = tracks.get(track.track_id)
                    if record is None:
                        record = {
                            "track_id": track.track_id,
                            "class_name": category,
                            "first_seen_timestamp": track.first_seen,
                            "last_seen_timestamp": track.last_seen,
                            "frames_seen": track.frames_seen,
                            "confidence": track.confidence,
                            "counted_crossing": False,
                            "crossing_timestamp": None,
                            "direction": None,
                            "speed_kmh": None,
                        }
                        tracks[track.track_id] = record
                        counts[category] += 1
                        minute = int(track.first_seen // 60)
                        minute_counts.setdefault(minute, {name: 0 for name in CATEGORIES})
                        minute_counts[minute][category] += 1
                    else:
                        record["last_seen_timestamp"] = track.last_seen
                        record["frames_seen"] = track.frames_seen
                        record["confidence"] = track.confidence

                    if (
                        counting_line
                        and track.track_id not in crossing_track_ids
                        and len(track.trajectory) >= 2
                    ):
                        previous = track.trajectory[-2][:2]
                        current = track.trajectory[-1][:2]
                        if _crossed_line(previous, current, counting_line):
                            crossing_track_ids.add(track.track_id)
                            record["counted_crossing"] = True
                            record["crossing_timestamp"] = timestamp_sec
                            record["direction"] = _direction(previous, current, counting_line)
                            minute = int(timestamp_sec // 60)
                            minute_counts.setdefault(minute, {name: 0 for name in CATEGORIES})
                            minute_counts[minute].setdefault("crossings", 0)
                            minute_counts[minute]["crossings"] += 1

                annotated = self._draw_annotations(
                    frame,
                    active_tracks,
                    counting_line,
                    counts,
                    len(tracks),
                    processed_frames,
                    frames_to_process,
                )
                writer.write(annotated)

                if processed_frames % 10 == 0 or processed_frames == frames_to_process:
                    elapsed = max(time.monotonic() - started, 1e-6)
                    progress = {
                        "session_id": session_id,
                        "status": "PROCESSING",
                        "frame": processed_frames,
                        "total_frames": frame_count,
                        "progress_percent": round(processed_frames / frame_count * 100, 1),
                        "processing_fps": round(processed_frames / elapsed, 2),
                        "raw_frame_detections": raw_detections,
                        "confirmed_unique_tracks": len(tracks),
                        "counted_crossings": len(crossing_track_ids),
                        "category_counts": dict(counts),
                        "data_source": "RECORDED VIDEO",
                    }
                    update_video_session(
                        session_id,
                        current_frame=processed_frames,
                        progress_percent=progress["progress_percent"],
                        raw_frame_detections=raw_detections,
                        confirmed_unique_tracks=len(tracks),
                        counted_crossings=len(crossing_track_ids),
                        total_vehicles_counted=sum(
                            counts[name] for name in CATEGORIES if name != "PEDESTRIAN"
                        ),
                    )
                    if progress_callback:
                        progress_callback(progress)

            elapsed = max(time.monotonic() - started, 1e-6)
            is_partial = (
                stopped
                or processed_frames < frame_count
                or (max_frames is not None and max_frames < frame_count)
            )
            total_motor = sum(
                counts[name]
                for name in CATEGORIES
                if name not in ("BICYCLE", "PEDESTRIAN")
            )
            total_vehicles = total_motor + counts["BICYCLE"]
            confirmed_tracks = list(tracks.values())
            confidences = [float(t["confidence"]) for t in confirmed_tracks]
            avg_confidence = (
                round(sum(confidences) / len(confidences), 4) if confidences else None
            )
            summary = {
                "session_id": session_id,
                "status": "PARTIAL" if is_partial else "COMPLETED",
                "video_filename": os.path.basename(video_path),
                "camera_id": camera_id,
                "data_source": "RECORDED VIDEO",
                "is_demo_data": False,
                "is_partial": is_partial,
                "video_start_timestamp": None,
                "video_end_timestamp": None,
                "video_duration_seconds": round(processed_frames / fps, 3),
                "source_width": width,
                "source_height": height,
                "source_fps": fps,
                "processed_frames": processed_frames,
                "processing_fps": round(processed_frames / elapsed, 2),
                "raw_frame_detections": raw_detections,
                "confirmed_unique_tracks": len(confirmed_tracks),
                "counted_crossings": len(crossing_track_ids),
                "unconfirmed_tracks": max(
                    0, self.tracker.total_created - self.tracker.total_confirmed
                ),
                "average_confidence": avg_confidence,
                "category_counts": counts,
                "total_motor_vehicles": total_motor,
                "total_vehicles_including_bicycle": total_vehicles,
                "pedestrians": counts["PEDESTRIAN"],
                "counting_line": counting_line,
                "speed_kmh": None,
                "speed_note": "Unavailable: calibrated ground-plane scale is required.",
                "exports": {},
            }

            summary_card = self._render_final_summary_card(
                width, height, session_id, counts, total_motor, total_vehicles, is_partial
            )
            for _ in range(max(1, round(SUMMARY_DURATION_SECONDS * fps))):
                writer.write(summary_card)
            writer.release()
            cap.release()
            _encode_browser_compatible_video(output_video)

            exports = self._save_export_bundle(
                session_dir, session_id, summary, confirmed_tracks, minute_counts
            )
            summary["exports"] = {
                name: os.path.basename(path) for name, path in exports.items()
            }
            summary_json = exports["processing_summary_json"]
            with open(summary_json, "w", encoding="utf-8") as file:
                json.dump(summary, file, indent=2)

            save_video_tracks(session_id, camera_id, confirmed_tracks)
            save_video_minute_counts(session_id, minute_counts)
            status = "PARTIAL" if is_partial else "COMPLETED"
            category_columns = {
                "two_wheeler_count": counts["TWO-WHEELER"],
                "three_wheeler_count": counts["THREE-WHEELER"],
                "four_wheeler_count": counts["FOUR-WHEELER"],
                "bus_count": counts["BUS"],
                "truck_count": counts["TRUCK"],
                "bicycle_count": counts["BICYCLE"],
                "other_count": counts["OTHER"],
                "pedestrian_count": counts["PEDESTRIAN"],
            }
            update_video_session(
                session_id,
                status=status,
                is_partial=int(is_partial),
                progress_percent=round(processed_frames / frame_count * 100, 1),
                current_frame=processed_frames,
                raw_frame_detections=raw_detections,
                confirmed_unique_tracks=len(confirmed_tracks),
                counted_crossings=len(crossing_track_ids),
                total_vehicles_counted=total_vehicles,
                processing_fps=summary["processing_fps"],
                average_confidence=avg_confidence,
                duration_seconds=summary["video_duration_seconds"],
                annotated_video_path=output_video,
                count_summary_csv=exports["count_summary_csv"],
                track_details_csv=exports["track_details_csv"],
                minute_wise_csv=exports["minute_wise_csv"],
                processing_summary_json=summary_json,
                output_directory=session_dir,
                end_time=datetime.now(timezone.utc).isoformat(),
                **category_columns,
            )
            return {
                **summary,
                "output_video_path": output_video,
                "output_directory": session_dir,
                "exports": exports,
            }
        except Exception as exc:
            logger.exception("Video-processing session %s failed", session_id)
            update_video_session(
                session_id,
                status="FAILED",
                is_partial=1,
                current_frame=processed_frames,
                raw_frame_detections=raw_detections,
                confirmed_unique_tracks=len(tracks),
                counted_crossings=len(crossing_track_ids),
                error_message=str(exc),
                end_time=datetime.now(timezone.utc).isoformat(),
            )
            raise
        finally:
            cap.release()
            writer.release()

    def _draw_annotations(
        self,
        frame: np.ndarray,
        tracks: List[TrackedVehicle],
        counting_line: Optional[Tuple[Tuple[int, int], Tuple[int, int]]],
        counts: Dict[str, int],
        total_unique: int,
        frame_idx: int,
        total_frames: int,
    ) -> np.ndarray:
        canvas = frame.copy()
        height, width = canvas.shape[:2]
        scale = max(0.5, min(width, height) / 1080)
        font = cv2.FONT_HERSHEY_SIMPLEX
        line_width = max(1, round(2 * scale))

        if counting_line:
            cv2.line(canvas, *counting_line, (0, 230, 255), line_width, cv2.LINE_AA)

        for track in tracks:
            x1, y1, x2, y2 = track.bbox
            color = track.color_bgr
            cv2.rectangle(canvas, (x1, y1), (x2, y2), color, line_width, cv2.LINE_AA)
            label = f"{track.track_id} {track.class_name} {track.confidence:.2f}"
            text_size, baseline = cv2.getTextSize(label, font, 0.55 * scale, line_width)
            label_y = y1 - text_size[1] - baseline - 6
            if label_y < 0:
                label_y = min(height - text_size[1] - baseline - 6, y2 + 4)
            label_x = min(max(0, x1), max(0, width - text_size[0] - 8))
            cv2.rectangle(
                canvas,
                (label_x, label_y),
                (label_x + text_size[0] + 8, label_y + text_size[1] + baseline + 6),
                color,
                -1,
            )
            cv2.putText(
                canvas,
                label,
                (label_x + 4, label_y + text_size[1] + 2),
                font,
                0.55 * scale,
                (255, 255, 255),
                line_width,
                cv2.LINE_AA,
            )

        overlay = canvas.copy()
        cv2.rectangle(overlay, (0, 0), (width, round(64 * scale)), (15, 23, 42), -1)
        cv2.addWeighted(overlay, 0.8, canvas, 0.2, 0, canvas)
        hud = (
            f"CONFIRMED UNIQUE TRACKS: {total_unique} | "
            f"2W {counts['TWO-WHEELER']}  3W {counts['THREE-WHEELER']}  "
            f"4W {counts['FOUR-WHEELER']}  BUS {counts['BUS']}  "
            f"TRUCK {counts['TRUCK']}  BIKE {counts['BICYCLE']}  "
            f"OTHER {counts['OTHER']}  PED {counts['PEDESTRIAN']}"
        )
        cv2.putText(
            canvas, hud, (round(18 * scale), round(40 * scale)), font,
            0.48 * scale, (255, 255, 255), line_width, cv2.LINE_AA,
        )
        progress = f"FRAME {frame_idx}/{total_frames}"
        text_width = cv2.getTextSize(progress, font, 0.5 * scale, line_width)[0][0]
        cv2.putText(
            canvas, progress, (width - text_width - 16, round(40 * scale)),
            font, 0.5 * scale, (0, 230, 255), line_width, cv2.LINE_AA,
        )
        return canvas

    def _render_final_summary_card(
        self,
        width: int,
        height: int,
        session_id: str,
        counts: Dict[str, int],
        total_motor: int,
        total_vehicles: int,
        is_partial: bool,
    ) -> np.ndarray:
        card = np.full((height, width, 3), (22, 18, 12), dtype=np.uint8)
        scale = max(0.6, min(width, height) / 1080)
        font = cv2.FONT_HERSHEY_SIMPLEX
        margin = round(width * 0.04)
        title_scale = min(1.5 * scale, 2.1)
        cv2.rectangle(card, (0, 0), (width, round(90 * scale)), (44, 32, 20), -1)
        cv2.line(card, (0, round(90 * scale)), (width, round(90 * scale)), (0, 215, 255), max(2, round(3 * scale)))
        cv2.putText(
            card,
            "FINAL VEHICLE DETECTION SUMMARY" + (" - PARTIAL" if is_partial else ""),
            (margin, round(58 * scale)), font, title_scale, (255, 255, 255),
            max(1, round(2 * scale)), cv2.LINE_AA,
        )
        cv2.putText(
            card, f"Session: {session_id} | Source: RECORDED VIDEO",
            (margin, round(130 * scale)), font, 0.58 * scale, (170, 185, 200),
            max(1, round(scale)), cv2.LINE_AA,
        )

        labels = [
            ("TWO-WHEELERS", "TWO-WHEELER"),
            ("THREE-WHEELERS", "THREE-WHEELER"),
            ("FOUR-WHEELERS", "FOUR-WHEELER"),
            ("BUSES", "BUS"),
            ("TRUCKS", "TRUCK"),
            ("BICYCLES", "BICYCLE"),
            ("OTHER / UNKNOWN", "OTHER"),
            ("PEDESTRIANS (SEPARATE)", "PEDESTRIAN"),
        ]
        top = round(190 * scale)
        row_height = max(42, round((height - top - 160 * scale) / len(labels)))
        for index, (label, category) in enumerate(labels):
            y = top + index * row_height
            color = get_vehicle_spec(category)["color_bgr"]
            cv2.circle(card, (margin + round(14 * scale), y), max(4, round(8 * scale)), color, -1)
            cv2.putText(
                card, label, (margin + round(38 * scale), y + round(8 * scale)),
                font, 0.65 * scale, (230, 235, 240), max(1, round(scale)), cv2.LINE_AA,
            )
            cv2.putText(
                card, str(counts[category]), (margin + round(width * 0.55), y + round(10 * scale)),
                font, 0.78 * scale, (255, 255, 255), max(1, round(2 * scale)), cv2.LINE_AA,
            )

        footer_y = height - round(88 * scale)
        cv2.line(card, (margin, footer_y - round(18 * scale)), (width - margin, footer_y - round(18 * scale)), (70, 80, 90), 1)
        cv2.putText(
            card,
            f"TOTAL MOTOR VEHICLES: {total_motor}   |   TOTAL VEHICLES INCLUDING BICYCLES: {total_vehicles}",
            (margin, footer_y), font, 0.58 * scale, (0, 230, 160), max(1, round(scale)), cv2.LINE_AA,
        )
        cv2.putText(
            card, "Unique confirmed tracks; buses and trucks excluded from four-wheeler subtotal.",
            (margin, footer_y + round(34 * scale)), font, 0.46 * scale, (150, 165, 180), 1, cv2.LINE_AA,
        )
        return card

    def _save_export_bundle(
        self,
        session_dir: str,
        session_id: str,
        summary: Dict[str, Any],
        tracks: List[Dict[str, Any]],
        minute_counts: Dict[int, Dict[str, int]],
    ) -> Dict[str, str]:
        paths = {
            "count_summary_csv": os.path.join(session_dir, "vehicle_count_summary.csv"),
            "track_details_csv": os.path.join(session_dir, "vehicle_track_details.csv"),
            "minute_wise_csv": os.path.join(session_dir, "minute_wise_vehicle_counts.csv"),
            "processing_summary_json": os.path.join(session_dir, "processing_summary.json"),
        }
        counts = summary["category_counts"]
        rows = [
            ("TWO-WHEELER", counts["TWO-WHEELER"]),
            ("THREE-WHEELER", counts["THREE-WHEELER"]),
            ("FOUR-WHEELER", counts["FOUR-WHEELER"]),
            ("BUS", counts["BUS"]),
            ("TRUCK", counts["TRUCK"]),
            ("BICYCLE", counts["BICYCLE"]),
            ("OTHER / UNKNOWN VEHICLE", counts["OTHER"]),
            ("PEDESTRIAN", counts["PEDESTRIAN"]),
            ("TOTAL MOTOR VEHICLES", summary["total_motor_vehicles"]),
            ("TOTAL VEHICLES INCLUDING BICYCLES", summary["total_vehicles_including_bicycle"]),
        ]
        with open(paths["count_summary_csv"], "w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(["session_id", "video_filename", "camera_id", "data_source", "class", "unique_count", "is_partial"])
            for label, count in rows:
                writer.writerow([
                    session_id, summary["video_filename"], summary["camera_id"],
                    summary["data_source"], label, count, summary["is_partial"],
                ])

        with open(paths["track_details_csv"], "w", newline="", encoding="utf-8") as file:
            columns = [
                "session_id", "camera_id", "track_id", "class_name", "confidence",
                "first_seen_timestamp", "last_seen_timestamp", "frames_seen",
                "direction", "counted_crossing", "crossing_timestamp", "speed_kmh",
            ]
            writer = csv.DictWriter(file, fieldnames=columns)
            writer.writeheader()
            for track in tracks:
                writer.writerow({"session_id": session_id, "camera_id": summary["camera_id"], **track})

        with open(paths["minute_wise_csv"], "w", newline="", encoding="utf-8") as file:
            columns = [
                "minute_index", "minute_start_offset_seconds", "recording_timestamp",
                *CATEGORIES, "total_motor_vehicles", "total_vehicles", "crossings",
            ]
            writer = csv.DictWriter(file, fieldnames=columns)
            writer.writeheader()
            for minute, data in sorted(minute_counts.items()):
                motor = sum(data.get(name, 0) for name in CATEGORIES if name not in ("BICYCLE", "PEDESTRIAN"))
                vehicles = motor + data.get("BICYCLE", 0)
                writer.writerow({
                    "minute_index": minute,
                    "minute_start_offset_seconds": minute * 60,
                    "recording_timestamp": "",
                    **{name: data.get(name, 0) for name in CATEGORIES},
                    "total_motor_vehicles": motor,
                    "total_vehicles": vehicles,
                    "crossings": data.get("crossings", 0),
                })
        return paths


video_processor = VideoProcessor()
