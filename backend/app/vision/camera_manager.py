"""
Camera Manager Module.
Configures, verifies, and reads video streams (RTSP, video files, webcams)
for Camera A (upstream junction) and Camera B (downstream junction).
"""
import cv2
import os
import time
import logging
import re
import threading
from typing import Dict, Any, Optional, Generator, Tuple
from app.database.database import get_db_connection

logger = logging.getLogger(__name__)


class VideoSource:
    """Encapsulates an active video capture source."""
    def __init__(self, camera_id: str, source_uri: str, name: str, junction: str):
        self.camera_id = camera_id
        self.source_uri = source_uri
        self.name = name
        self.junction = junction
        self.cap: Optional[cv2.VideoCapture] = None
        self.fps: float = 30.0
        self.total_frames: int = 0
        self.width: int = 1280
        self.height: int = 720
        self.is_opened = False
        self._open()

    def _open(self):
        try:
            # Check if integer (webcam index)
            if self.source_uri.isdigit():
                self.cap = cv2.VideoCapture(int(self.source_uri))
            else:
                self.cap = cv2.VideoCapture(self.source_uri)

            if self.cap.isOpened():
                self.is_opened = True
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 30.0
                if self.fps <= 0 or self.fps > 120:
                    self.fps = 30.0
                self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
                self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
                self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
                logger.info(f"Opened video source [{self.camera_id}] {self.name}: "
                            f"{self.width}x{self.height} @ {self.fps:.1f} FPS, {self.total_frames} frames")
            else:
                self.is_opened = False
                logger.warning(f"Could not open video source [{self.camera_id}]")
        except Exception as e:
            self.is_opened = False
            logger.error(f"Error opening source [{self.camera_id}]: {e}")

    def read_frame(self) -> Tuple[bool, Optional[cv2.Mat], float]:
        """Read a frame, return (success, frame, timestamp_sec)."""
        if not self.is_opened or self.cap is None:
            return False, None, 0.0

        ret, frame = self.cap.read()
        if not ret or frame is None:
            return False, None, 0.0

        pos_msec = self.cap.get(cv2.CAP_PROP_POS_MSEC)
        timestamp_sec = pos_msec / 1000.0 if pos_msec > 0 else time.time()
        return True, frame, timestamp_sec

    def release(self):
        if self.cap is not None:
            self.cap.release()
            self.is_opened = False


class CameraManager:
    """Manages Camera A and Camera B sources and settings."""
    def __init__(self):
        self.sources: Dict[str, VideoSource] = {}
        self._lock = threading.RLock()

    def get_all_cameras(self) -> list:
        """Fetch all cameras configured in the database."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM cameras ORDER BY code ASC")
            rows = cursor.fetchall()
            return [self._public_camera(dict(row)) for row in rows]

    def get_camera(self, camera_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,))
            row = cursor.fetchone()
            return self._public_camera(dict(row)) if row else None

    def _public_camera(self, camera: Dict[str, Any]) -> Dict[str, Any]:
        """Return camera metadata without credentials or falsely asserted liveness."""
        camera.pop("rtsp_url", None)
        camera.pop("stream_url", None)
        camera.pop("file_path", None)
        source = self.sources.get(camera["id"])
        camera["status"] = "CONNECTED" if source and source.is_opened else "DISCONNECTED"
        camera["credentials_configured"] = bool(
            os.getenv(CameraManager._credential_env_name(camera["id"]))
        )
        return camera

    @staticmethod
    def _credential_env_name(camera_id: str) -> str:
        normalized = re.sub(r"[^A-Za-z0-9]", "_", camera_id).upper()
        return f"CAMERA_RTSP_{normalized}"

    def update_camera(self, camera_id: str, updates: Dict[str, Any]) -> bool:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            fields = []
            values = []
            for k, v in updates.items():
                if k in ("name", "junction", "video_source", "file_path", "latitude", "longitude", "resolution", "fps", "direction", "code"):
                    fields.append(f"{k} = ?")
                    values.append(v)
            if not fields:
                return False
            values.append(camera_id)
            cursor.execute(f"UPDATE cameras SET {', '.join(fields)} WHERE id = ?", tuple(values))
            return cursor.rowcount > 0

    def start_stream(self, camera_id: str) -> Optional[VideoSource]:
        """Start or retrieve an active video source for the given camera ID."""
        with self._lock:
            if camera_id in self.sources and self.sources[camera_id].is_opened:
                return self.sources[camera_id]

            cam = self.get_camera(camera_id)
            if not cam:
                return None

            raw_cam = self._get_camera_source_fields(camera_id)
            source_kind = (raw_cam.get("video_source") or "rtsp").lower()
            if source_kind == "rtsp":
                uri = os.getenv(self._credential_env_name(camera_id), "")
                if not uri:
                    raise ValueError(
                        f"Set {self._credential_env_name(camera_id)} in the backend environment to connect this RTSP camera"
                    )
                if not uri.startswith("rtsp://"):
                    raise ValueError("Configured RTSP source must use the rtsp:// scheme")
            elif source_kind == "webcam":
                uri = str(raw_cam.get("file_path") or "0")
            else:
                uri = raw_cam.get("file_path") or ""
                if not uri:
                    raise ValueError("A local video path is required for this camera")
                root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
                relative = uri.lstrip("/\\")
                candidates = [
                    uri,
                    os.path.join(root, uri),
                    os.path.join(root, "frontend", "public", relative),
                ]
                uri = next((os.path.abspath(path) for path in candidates if os.path.isfile(path)), "")
                if not os.path.isfile(uri):
                    raise FileNotFoundError("Configured local video file does not exist")

            src = VideoSource(camera_id=camera_id, source_uri=uri, name=cam["name"], junction=cam["junction"])
            self.sources[camera_id] = src
            if not src.is_opened:
                raise RuntimeError(f"Unable to open configured source for camera {camera_id}")
            return src

    def stop_stream(self, camera_id: str):
        with self._lock:
            if camera_id in self.sources:
                self.sources[camera_id].release()
                del self.sources[camera_id]

    def _get_camera_source_fields(self, camera_id: str) -> Dict[str, Any]:
        with get_db_connection() as conn:
            row = conn.execute(
                "SELECT video_source, file_path FROM cameras WHERE id = ?",
                (camera_id,),
            ).fetchone()
            return dict(row) if row else {}


# Singleton instance
camera_manager = CameraManager()
