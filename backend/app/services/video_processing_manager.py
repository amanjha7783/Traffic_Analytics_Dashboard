import json
import logging
import threading
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

from app.database.database import update_video_session
from app.vision.detector import YOLOv8Detector
from app.vision.video_processor import VideoProcessor
from app.services.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)


@dataclass
class VideoJob:
    thread: threading.Thread
    pause_event: threading.Event = field(default_factory=threading.Event)
    stop_event: threading.Event = field(default_factory=threading.Event)


class VideoProcessingManager:
    def __init__(self):
        self.jobs: Dict[str, VideoJob] = {}
        self.lock = threading.Lock()

    def start(
        self,
        session_id: str,
        video_path: str,
        camera_id: str,
        counting_line: Optional[Tuple[Tuple[int, int], Tuple[int, int]]],
        confidence_threshold: float,
    ) -> None:
        with self.lock:
            if session_id in self.jobs:
                raise ValueError("This video-processing session is already running")
            pause_event = threading.Event()
            stop_event = threading.Event()
            thread = threading.Thread(
                target=self._run,
                args=(
                    session_id, video_path, camera_id, counting_line,
                    confidence_threshold, pause_event, stop_event,
                ),
                name=f"video-processing-{session_id}",
                daemon=True,
            )
            self.jobs[session_id] = VideoJob(thread, pause_event, stop_event)
            thread.start()

    def _run(
        self,
        session_id: str,
        video_path: str,
        camera_id: str,
        counting_line: Optional[Tuple[Tuple[int, int], Tuple[int, int]]],
        confidence_threshold: float,
        pause_event: threading.Event,
        stop_event: threading.Event,
    ) -> None:
        try:
            detector = YOLOv8Detector(conf_threshold=confidence_threshold)
            result = VideoProcessor(detector=detector).process_video(
                session_id=session_id,
                video_path=video_path,
                camera_id=camera_id,
                counting_line=counting_line,
                pause_event=pause_event,
                stop_event=stop_event,
                progress_callback=websocket_manager.publish_from_thread,
            )
            websocket_manager.publish_from_thread(
                {
                    "type": "video_processing",
                    "session_id": session_id,
                    "status": result["status"],
                    "summary": result,
                }
            )
        except Exception as exc:
            logger.exception("Could not complete video-processing session %s", session_id)
            try:
                update_video_session(
                    session_id,
                    status="FAILED",
                    is_partial=1,
                    error_message=str(exc),
                )
            except KeyError:
                logger.error("Failed video session %s was not persisted", session_id)
            websocket_manager.publish_from_thread(
                {
                    "type": "video_processing",
                    "session_id": session_id,
                    "status": "FAILED",
                    "error": str(exc),
                }
            )
        finally:
            with self.lock:
                self.jobs.pop(session_id, None)

    def pause(self, session_id: str) -> None:
        job = self._get_job(session_id)
        job.pause_event.set()
        update_video_session(session_id, status="PAUSED")

    def resume(self, session_id: str) -> None:
        job = self._get_job(session_id)
        job.pause_event.clear()
        update_video_session(session_id, status="PROCESSING")

    def stop(self, session_id: str) -> None:
        job = self._get_job(session_id)
        job.pause_event.clear()
        job.stop_event.set()

    def _get_job(self, session_id: str) -> VideoJob:
        with self.lock:
            job = self.jobs.get(session_id)
        if job is None or not job.thread.is_alive():
            raise KeyError(f"No active processing session named {session_id}")
        return job


video_processing_manager = VideoProcessingManager()
