import logging
import threading
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, Iterator, Optional

import cv2

from app.config import DETECTION_MAX_FPS
from app.services.websocket_manager import websocket_manager
from app.vision.camera_manager import VideoSource, camera_manager
from app.vision.detector import YOLOv8Detector
from app.vision.tracker import VehicleTracker
from app.vision.video_processor import CATEGORIES, VideoProcessor

logger = logging.getLogger(__name__)


@dataclass
class LiveCameraWorker:
    camera_id: str
    source: VideoSource
    source_kind: str
    stop_event: threading.Event = field(default_factory=threading.Event)
    thread: Optional[threading.Thread] = None
    lock: threading.Lock = field(default_factory=threading.Lock)
    latest_jpeg: Optional[bytes] = None
    status: str = "CONNECTING"
    last_error: Optional[str] = None
    raw_detections: int = 0
    confirmed_tracks: set[int] = field(default_factory=set)
    counts: Counter = field(default_factory=Counter)
    frames_processed: int = 0
    processing_fps: float = 0.0
    is_demo_data: bool = False

    def snapshot(self) -> dict:
        with self.lock:
            return {
                "camera_id": self.camera_id,
                "status": self.status,
                "last_error": self.last_error,
                "raw_frame_detections": self.raw_detections,
                "confirmed_unique_tracks": len(self.confirmed_tracks),
                "category_counts": {name: self.counts.get(name, 0) for name in CATEGORIES},
                "frames_processed": self.frames_processed,
                "processing_fps": round(self.processing_fps, 2),
                "data_source": {
                    "rtsp": "LIVE RTSP CAMERA",
                    "webcam": "LIVE WEBCAM",
                    "local": "LOCAL VIDEO",
                    "sample": "DEMO VIDEO",
                }.get(self.source_kind, "UNKNOWN SOURCE"),
                "is_demo_data": self.is_demo_data,
            }


class LiveCameraManager:
    def __init__(self):
        self.workers: Dict[str, LiveCameraWorker] = {}
        self.lock = threading.RLock()

    def start(self, camera_id: str) -> LiveCameraWorker:
        with self.lock:
            current = self.workers.get(camera_id)
            if current and current.thread and current.thread.is_alive():
                return current
            camera = camera_manager.get_camera(camera_id)
            if camera is None:
                raise KeyError(f"Camera {camera_id} is not configured")
            source = camera_manager.start_stream(camera_id)
            if source is None:
                raise KeyError(f"Camera {camera_id} is not configured")
            worker = LiveCameraWorker(
                camera_id=camera_id,
                source=source,
                source_kind=str(camera.get("video_source") or "rtsp").lower(),
                is_demo_data=str(camera.get("video_source") or "").lower() == "sample",
            )
            worker.thread = threading.Thread(
                target=self._run,
                args=(worker,),
                name=f"camera-{camera_id}",
                daemon=True,
            )
            self.workers[camera_id] = worker
            worker.thread.start()
            return worker

    def _run(self, worker: LiveCameraWorker) -> None:
        detector = YOLOv8Detector()
        tracker = VehicleTracker()
        annotator = VideoProcessor(detector=detector, tracker=tracker)
        if not detector.is_ready():
            with worker.lock:
                worker.status = "ERROR"
                worker.last_error = detector.load_error or "Detector is unavailable"
            camera_manager.stop_stream(worker.camera_id)
            return

        retries = 0
        last_detection = 0.0
        last_frame = time.monotonic()
        started = last_frame
        period = 1.0 / max(0.1, DETECTION_MAX_FPS)
        source = worker.source
        with worker.lock:
            worker.status = "CONNECTED"
        while not worker.stop_event.is_set():
            ok, frame, timestamp = source.read_frame()
            if not ok or frame is None:
                if worker.source_kind in ("local", "sample"):
                    with worker.lock:
                        worker.status = "END_OF_FILE"
                    break
                retries += 1
                with worker.lock:
                    worker.status = "RECONNECTING"
                    worker.last_error = "Stream read failed; retrying"
                camera_manager.stop_stream(worker.camera_id)
                if retries > 5:
                    with worker.lock:
                        worker.status = "ERROR"
                        worker.last_error = "Stream unavailable after 5 reconnect attempts"
                    break
                worker.stop_event.wait(min(15, 2 ** (retries - 1)))
                if worker.stop_event.is_set():
                    break
                try:
                    source = camera_manager.start_stream(worker.camera_id)
                    if source is None:
                        raise RuntimeError("Camera configuration disappeared")
                    worker.source = source
                    with worker.lock:
                        worker.status = "CONNECTED"
                        worker.last_error = None
                except (FileNotFoundError, RuntimeError, ValueError) as exc:
                    with worker.lock:
                        worker.last_error = str(exc)
                continue

            now = time.monotonic()
            if worker.source_kind in ("local", "sample"):
                frame_period = 1.0 / max(1.0, source.fps)
                wait = frame_period - (now - last_frame)
                if wait > 0:
                    worker.stop_event.wait(wait)
                last_frame = time.monotonic()
                now = last_frame
            if now - last_detection < period:
                worker.stop_event.wait(period - (now - last_detection))
                continue
            last_detection = now
            try:
                detections = detector.detect(frame)
                tracked = tracker.update(detections, timestamp=timestamp)
            except (RuntimeError, cv2.error) as exc:
                with worker.lock:
                    worker.status = "ERROR"
                    worker.last_error = str(exc)
                break

            with worker.lock:
                worker.raw_detections += len(detections)
                worker.frames_processed += 1
                elapsed = max(time.monotonic() - started, 1e-6)
                worker.processing_fps = worker.frames_processed / elapsed
                for track in tracked:
                    if track.track_id not in worker.confirmed_tracks:
                        worker.confirmed_tracks.add(track.track_id)
                        worker.counts[track.class_name] += 1
                counts = {name: worker.counts.get(name, 0) for name in CATEGORIES}
                total_tracks = len(worker.confirmed_tracks)
                worker.status = "CONNECTED"

            annotated = annotator._draw_annotations(
                frame, tracked, None, counts, total_tracks,
                worker.frames_processed, worker.frames_processed,
            )
            encoded, buffer = cv2.imencode(".jpg", annotated)
            if encoded:
                with worker.lock:
                    worker.latest_jpeg = buffer.tobytes()
            websocket_manager.publish_from_thread(
                {"type": "camera_metrics", **worker.snapshot()}
            )

        if worker.status not in ("ERROR", "END_OF_FILE"):
            with worker.lock:
                worker.status = "DISCONNECTED"
        camera_manager.stop_stream(worker.camera_id)

    def stop(self, camera_id: str) -> None:
        with self.lock:
            worker = self.workers.get(camera_id)
        if worker is None:
            camera_manager.stop_stream(camera_id)
            return
        worker.stop_event.set()
        if worker.thread and worker.thread.is_alive():
            worker.thread.join(timeout=3)
        camera_manager.stop_stream(camera_id)
        with worker.lock:
            if worker.status not in ("ERROR", "END_OF_FILE"):
                worker.status = "DISCONNECTED"

    def get(self, camera_id: str) -> Optional[LiveCameraWorker]:
        with self.lock:
            return self.workers.get(camera_id)

    def stream(self, camera_id: str) -> Iterator[bytes]:
        worker = self.get(camera_id)
        if worker is None:
            raise KeyError(camera_id)
        while not worker.stop_event.is_set():
            with worker.lock:
                frame = worker.latest_jpeg
                status = worker.status
            if frame:
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
            if status in ("ERROR", "END_OF_FILE", "DISCONNECTED"):
                break
            time.sleep(0.05)


live_camera_manager = LiveCameraManager()
