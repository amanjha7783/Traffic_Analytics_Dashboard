"""
Video Upload, Metadata Extraction, and First-Frame Generation Service.
Safely ingests raw CCTV video files (MP4, MOV, AVI, MKV), validates codecs and containers,
extracts structural metadata (duration, width, height, FPS, frame counts),
and generates first-frame and thumbnail images for calibration and preview.
"""
import os
import uuid
import shutil
import logging
from typing import Dict, Any, Optional, Tuple
from pathlib import Path
import cv2

from app.config import DATA_DIR, MAX_UPLOAD_BYTES
from app.video_intelligence.database import get_db

logger = logging.getLogger(__name__)

STUDIO_DIR = DATA_DIR / "studio"
PROJECTS_DIR = STUDIO_DIR / "projects"
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv"}


def ensure_studio_directories():
    """Ensure root studio storage directories exist."""
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)


def get_video_storage_dir(project_id: str, video_id: str) -> Path:
    """Return isolated directory for a specific video within a project."""
    v_dir = PROJECTS_DIR / project_id / "videos" / video_id
    v_dir.mkdir(parents=True, exist_ok=True)
    return v_dir


def extract_video_metadata(file_path: str) -> Dict[str, Any]:
    """
    Open video via OpenCV VideoCapture and extract structural attributes.
    Returns: duration_seconds, width, height, fps, total_frames, codec, file_size_bytes.
    """
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        raise ValueError(f"Unable to decode video file: {file_path}")

    fps = float(cap.get(cv2.CAP_PROP_FPS))
    if not math_is_valid(fps) or fps <= 0.0:
        fps = 30.0

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))

    codec = "".join([chr((fourcc >> 8 * i) & 0xFF) for i in range(4)])
    if not codec or not codec.isprintable():
        codec = "H.264 / AVC"

    duration = total_frames / fps if total_frames > 0 and fps > 0 else 0.0

    cap.release()

    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    return {
        "duration_seconds": round(duration, 2),
        "width": width,
        "height": height,
        "fps": round(fps, 2),
        "total_frames": total_frames,
        "codec": codec,
        "file_size_bytes": file_size,
        "has_audio": 0,
    }


def extract_first_frame_and_thumbnail(
    file_path: str,
    output_dir: Path
) -> Tuple[Optional[str], Optional[str]]:
    """
    Extract first frame (t=0) and thumbnail image from video.
    Saves first_frame.jpg and thumbnail.jpg in output_dir.
    Returns: (first_frame_rel_path, thumbnail_rel_path).
    """
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        return None, None

    success, frame = cap.read()
    if not success or frame is None:
        cap.release()
        return None, None

    first_frame_file = output_dir / "first_frame.jpg"
    thumbnail_file = output_dir / "thumbnail.jpg"

    # Save original resolution first frame
    cv2.imwrite(str(first_frame_file), frame, [cv2.IMWRITE_JPEG_QUALITY, 92])

    # Save resized thumbnail (480px width)
    h, w = frame.shape[:2]
    thumb_w = 480
    thumb_h = int((thumb_w / w) * h) if w > 0 else 270
    thumb_frame = cv2.resize(frame, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(thumbnail_file), thumb_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])

    cap.release()

    return str(first_frame_file), str(thumbnail_file)


def math_is_valid(val: float) -> bool:
    import math
    return not math.isnan(val) and not math.isinf(val)


def save_uploaded_video(
    project_id: str,
    filename: str,
    file_obj,
    camera_id: Optional[str] = None,
    name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Save uploaded file stream, extract metadata, generate preview images,
    and persist in database.
    """
    ensure_studio_directories()

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported video format '{ext}'. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}")

    video_id = f"vid-{uuid.uuid4().hex[:10]}"
    cam_id = camera_id or f"cam-{video_id[:8]}"
    display_name = name or os.path.splitext(filename)[0]

    video_dir = get_video_storage_dir(project_id, video_id)
    saved_file_path = video_dir / f"original{ext}"

    # Stream write to disk
    with open(saved_file_path, "wb") as buffer:
        shutil.copyfileobj(file_obj, buffer)

    file_size = os.path.getsize(saved_file_path)
    if file_size > MAX_UPLOAD_BYTES:
        os.remove(saved_file_path)
        raise ValueError(f"Video file exceeds maximum allowed limit ({MAX_UPLOAD_BYTES // (1024*1024)} MB).")

    # Extract metadata and first frame
    metadata = extract_video_metadata(str(saved_file_path))
    first_frame_path, thumbnail_path = extract_first_frame_and_thumbnail(str(saved_file_path), video_dir)

    # Persist in studio_videos table
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        conn.execute("""
        INSERT INTO studio_videos (
            id, project_id, camera_id, name, filename, file_path,
            file_size_bytes, duration_seconds, width, height, fps,
            total_frames, codec, has_audio, thumbnail_path, first_frame_path,
            status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'READY', ?)
        """, (
            video_id, project_id, cam_id, display_name, filename, str(saved_file_path),
            metadata["file_size_bytes"], metadata["duration_seconds"],
            metadata["width"], metadata["height"], metadata["fps"],
            metadata["total_frames"], metadata["codec"], metadata["has_audio"],
            str(thumbnail_path) if thumbnail_path else None,
            str(first_frame_path) if first_frame_path else None,
            now_iso
        ))

    return {
        "id": video_id,
        "project_id": project_id,
        "camera_id": cam_id,
        "name": display_name,
        "filename": filename,
        "file_size_bytes": metadata["file_size_bytes"],
        "duration_seconds": metadata["duration_seconds"],
        "width": metadata["width"],
        "height": metadata["height"],
        "fps": metadata["fps"],
        "total_frames": metadata["total_frames"],
        "codec": metadata["codec"],
        "status": "READY",
        "has_first_frame": bool(first_frame_path),
        "created_at": now_iso,
    }
