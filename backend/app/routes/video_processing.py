import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Optional, Tuple

import cv2
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response, StreamingResponse

from app.config import (
    DATA_DIR,
    MAX_UPLOAD_BYTES,
    MODEL_PATH,
    OUTPUT_DIR,
    PRIMARY_ANNOTATED_VIDEO_PATH,
)
from app.database.database import (
    create_video_session,
    get_latest_completed_video_session,
    get_video_minute_counts,
    get_video_session,
    update_video_session,
)
from app.services.video_processing_manager import video_processing_manager
from app.vision.detector import YOLOv8Detector

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv"}
ALLOWED_CONTENT_TYPES = {
    ".mp4": {"video/mp4", "application/mp4", "application/octet-stream"},
    ".mov": {"video/quicktime", "video/mp4", "application/octet-stream"},
    ".avi": {"video/x-msvideo", "video/avi", "application/octet-stream"},
    ".mkv": {"video/x-matroska", "application/octet-stream"},
}
SUPPORTED_ANNOTATED_EXTENSIONS = {".mp4"}
VIDEO_CHUNK_SIZE = 1024 * 1024
RANGE_PATTERN = re.compile(r"bytes=(\d*)-(\d*)$")
EXPORT_COLUMNS = {
    "annotated_video": "annotated_video_path",
    "count_summary": "count_summary_csv",
    "track_details": "track_details_csv",
    "minute_counts": "minute_wise_csv",
    "processing_summary": "processing_summary_json",
}
STATIC_EXPORT_FILES = {
    "count_summary": "vehicle_count_summary.csv",
    "track_details": "vehicle_track_details.csv",
    "minute_counts": "minute_wise_vehicle_counts.csv",
    "processing_summary": "processing_summary.json",
}
PRIVATE_SESSION_FIELDS = {
    "output_directory",
    "processing_summary_json",
}


def _is_inside_exports(path: Path, output_root: Path) -> bool:
    try:
        path.relative_to(output_root)
        return True
    except ValueError:
        return False


def _read_processing_summary(path: Path) -> dict:
    summary_path = path.parent / "processing_summary.json"
    if not summary_path.is_file():
        return {}
    try:
        with summary_path.open(encoding="utf-8") as file:
            summary = json.load(file)
        return summary if isinstance(summary, dict) else {}
    except (OSError, UnicodeError, json.JSONDecodeError):
        logger.exception("Could not read processing summary for %s", path)
        return {}


def _video_metadata(path: Path, output_root: Path) -> Optional[dict]:
    try:
        resolved = path.resolve(strict=True)
        if not _is_inside_exports(resolved, output_root) or resolved.suffix.lower() not in SUPPORTED_ANNOTATED_EXTENSIONS:
            logger.warning("Skipping annotated video outside approved exports or with unsupported format: %s", path)
            return None
        if not resolved.is_file() or resolved.stat().st_size <= 0:
            return None

        capture = cv2.VideoCapture(str(resolved))
        try:
            if not capture.isOpened():
                logger.warning("Annotated video is not readable: %s", resolved)
                return None
            width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
            frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            has_frame, _ = capture.read()
        finally:
            capture.release()

        if not has_frame or min(width, height, frames) <= 0 or fps <= 0:
            logger.warning("Annotated video has invalid media metadata: %s", resolved)
            return None

        summary = _read_processing_summary(resolved)
        job_id = resolved.parent.name
        processing_job_id = str(summary.get("session_id") or job_id)
        return {
            "recording_id": job_id,
            "display_name": "",
            "available": True,
            "duration_seconds": round(frames / fps, 3),
            "width": width,
            "height": height,
            "file_size_bytes": resolved.stat().st_size,
            "processing_job_id": processing_job_id,
            "status": summary.get("status"),
            "summary": {
                key: summary[key]
                for key in (
                    "data_source",
                    "is_partial",
                    "video_filename",
                    "category_counts",
                    "total_motor_vehicles",
                    "total_vehicles_including_bicycle",
                    "pedestrians",
                    "speed_kmh",
                    "speed_note",
                )
                if key in summary
            },
            "stream_url": f"/api/video-processing/recordings/{job_id}/stream",
            "_path": resolved,
            "_job_directory": resolved.parent,
            "_has_summary": bool(summary),
            "_file_modified": resolved.stat().st_mtime,
        }
    except (OSError, cv2.error):
        logger.exception("Could not inspect annotated video %s", path)
        return None


def _discover_annotated_recordings(*, include_internal: bool = False) -> list[dict]:
    output_root = Path(OUTPUT_DIR).resolve()
    if not output_root.is_dir():
        logger.warning("Configured annotated-video export directory does not exist: %s", output_root)
        return []

    recordings: list[dict] = []
    primary_path = Path(PRIMARY_ANNOTATED_VIDEO_PATH)
    if not primary_path.is_absolute():
        primary_path = output_root / primary_path
    primary = _video_metadata(primary_path, output_root)
    primary_job_directory = primary.get("_job_directory") if primary else None
    if primary:
        primary["display_name"] = "Annotated Recording 1"
        recordings.append(primary)
    elif primary_path.exists():
        logger.error("Configured primary annotated video is invalid or outside exports: %s", primary_path)

    candidates: list[dict] = []
    try:
        paths = (
            path
            for name in ("annotated.mp4", "annotated_browser.mp4")
            for path in output_root.rglob(name)
        )
        for path in paths:
            try:
                candidate = _video_metadata(path, output_root)
                if candidate is None:
                    continue
                if candidate["_path"] == (primary.get("_path") if primary else None):
                    continue
                if primary_job_directory and candidate["_job_directory"] == primary_job_directory:
                    continue
                candidates.append(candidate)
            except OSError:
                logger.exception("Could not inspect annotated-video candidate %s", path)
    except OSError:
        logger.exception("Could not scan annotated-video export directory %s", output_root)

    candidates.sort(
        key=lambda item: (
            str(item.get("status") or "").upper() != "COMPLETED",
            not item["_has_summary"],
            item["_path"].name != "annotated_browser.mp4",
            -item["_file_modified"],
        )
    )
    if candidates:
        candidates[0]["display_name"] = "Annotated Recording 2"
        recordings.append(candidates[0])

    if not include_internal:
        for recording in recordings:
            for private_key in (
                "_path", "_job_directory", "_has_summary", "_file_modified",
            ):
                recording.pop(private_key, None)
    return recordings


def _missing_recording(recording_number: int, error: str) -> dict:
    return {
        "recording_id": f"recording-{recording_number}-unavailable",
        "display_name": f"Annotated Recording {recording_number}",
        "available": False,
        "duration_seconds": None,
        "width": None,
        "height": None,
        "file_size_bytes": None,
        "processing_job_id": None,
        "status": None,
        "summary": {},
        "stream_url": None,
        "error": error,
    }


def _session_response(session: dict) -> dict:
    return {
        key: value
        for key, value in session.items()
        if not key.endswith(("_path", "_csv")) and key not in PRIVATE_SESSION_FIELDS
    }


def _static_export_path(recording: dict, export_name: str) -> Optional[Path]:
    job_directory = recording.get("_job_directory")
    if not isinstance(job_directory, Path):
        return None
    if export_name == "annotated_video":
        filenames = ("annotated_browser.mp4", "annotated.mp4")
    else:
        filename = STATIC_EXPORT_FILES.get(export_name)
        if filename is None:
            return None
        filenames = (filename,)

    for filename in filenames:
        try:
            path = (job_directory / filename).resolve(strict=True)
            if (
                path.is_file()
                and path.parent == job_directory.resolve()
                and _is_inside_exports(path, Path(OUTPUT_DIR).resolve())
            ):
                return path
        except OSError:
            continue
    return None


def _iter_file_range(path: Path, start: int, end: int):
    remaining = end - start + 1
    try:
        with path.open("rb") as media_file:
            media_file.seek(start)
            while remaining > 0:
                chunk = media_file.read(min(VIDEO_CHUNK_SIZE, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk
    except OSError:
        logger.exception("Could not stream annotated video %s", path)


def _parse_video_range(range_header: Optional[str], size: int) -> Optional[Tuple[int, int]]:
    if not range_header:
        return (0, size - 1)
    match = RANGE_PATTERN.fullmatch(range_header.strip())
    if not match or size <= 0:
        return None
    start_text, end_text = match.groups()
    if not start_text and not end_text:
        return None
    try:
        if not start_text:
            suffix_length = int(end_text)
            if suffix_length <= 0:
                return None
            return (max(size - suffix_length, 0), size - 1)
        start = int(start_text)
        end = int(end_text) if end_text else size - 1
    except ValueError:
        return None
    if start >= size or end < start:
        return None
    return (start, min(end, size - 1))


@router.get("/recordings")
def list_annotated_recordings():
    recordings = _discover_annotated_recordings()
    by_name = {item["display_name"]: item for item in recordings}
    primary = by_name.get("Annotated Recording 1") or _missing_recording(
        1, "Primary annotated recording is missing or unreadable. Check TRAFFIC_PRIMARY_ANNOTATED_VIDEO."
    )
    second = by_name.get("Annotated Recording 2") or _missing_recording(
        2, "Second annotated video not available. Add a distinct annotated MP4 job under TRAFFIC_OUTPUT_DIR."
    )
    return {"recordings": [primary, second]}


@router.get("/recordings/{recording_id}/stream")
def stream_annotated_recording(
    recording_id: str,
    range_header: Optional[str] = Header(None, alias="Range"),
):
    recording = next(
        (
            item for item in _discover_annotated_recordings(include_internal=True)
            if item["recording_id"] == recording_id
        ),
        None,
    )
    if recording is None:
        raise HTTPException(status_code=404, detail="Annotated recording not found")
    output_root = Path(OUTPUT_DIR).resolve()
    path = recording["_path"]

    try:
        resolved = path.resolve(strict=True)
        if not _is_inside_exports(resolved, output_root) or not resolved.is_file():
            raise HTTPException(status_code=404, detail="Annotated recording is unavailable")
        size = resolved.stat().st_size
        with resolved.open("rb"):
            pass
    except OSError as exc:
        logger.exception("Annotated recording is unavailable: %s", path)
        raise HTTPException(status_code=404, detail="Annotated recording is unavailable or unreadable") from exc

    byte_range = _parse_video_range(range_header, size)
    if byte_range is None:
        return Response(
            status_code=416,
            headers={"Content-Range": f"bytes */{size}", "Accept-Ranges": "bytes"},
        )
    start, end = byte_range
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(end - start + 1),
        "Content-Disposition": f'inline; filename="{resolved.name}"',
    }
    status_code = 200
    if range_header:
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        status_code = 206
    return StreamingResponse(
        _iter_file_range(resolved, start, end),
        status_code=status_code,
        media_type="video/mp4",
        headers=headers,
    )


def _parse_counting_line(value: Optional[str]) -> Optional[Tuple[Tuple[int, int], Tuple[int, int]]]:
    if not value:
        return None
    try:
        points = json.loads(value)
        if (
            not isinstance(points, list)
            or len(points) != 2
            or any(not isinstance(point, list) or len(point) != 2 for point in points)
        ):
            raise ValueError("counting line must be [[x1, y1], [x2, y2]]")
        return (
            (int(points[0][0]), int(points[0][1])),
            (int(points[1][0]), int(points[1][1])),
        )
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid counting_line: {exc}") from exc


@router.get("/models")
def list_detection_models():
    detector = YOLOv8Detector()
    return {
        "models": [
            {
                "model_id": "configured-yolo-onnx",
                "name": Path(MODEL_PATH).name,
                "available": detector.is_ready(),
                "error": detector.load_error,
                "supported_categories": [
                    "TWO-WHEELER", "FOUR-WHEELER", "BUS", "TRUCK", "BICYCLE", "PEDESTRIAN"
                ],
                "unavailable_categories": ["THREE-WHEELER"],
                "note": (
                    "COCO weights do not include auto-rickshaw/three-wheeler. "
                    "Provide compatible fine-tuned weights and class mapping to enable it."
                ),
            }
        ]
    }


@router.get("/latest")
def get_latest_completed_video():
    session = get_latest_completed_video_session()
    if session is None or not session.get("annotated_video_path"):
        recordings = _discover_annotated_recordings(include_internal=True)
        recording = next(
            (
                item for item in recordings
                if item.get("available")
                and str(item.get("status") or "").upper() == "COMPLETED"
            ),
            None,
        )
        if recording is None:
            raise HTTPException(status_code=404, detail="No completed annotated video is available")
        summary = recording["summary"]
        session_id = recording["processing_job_id"] or recording["recording_id"]
        exports = {
            export_name: (
                f"/api/video-processing/recordings/{recording['recording_id']}"
                f"/files/{export_name}"
            )
            for export_name in (*STATIC_EXPORT_FILES, "annotated_video")
            if _static_export_path(recording, export_name) is not None
        }
        return {
            "session_id": session_id,
            "video_name": summary.get("video_filename") or "Recorded video",
            "status": recording["status"],
            "summary": summary,
            "exports": exports,
        }
    response = _session_response(session)
    response["exports"] = {
        export_name: f"/api/video-processing/{session['session_id']}/files/{export_name}"
        for export_name, column in EXPORT_COLUMNS.items()
        if session.get(column)
    }
    summary_path = session.get("processing_summary_json")
    if summary_path and os.path.isfile(summary_path):
        with open(summary_path, encoding="utf-8") as file:
            response["summary"] = json.load(file)
    return response


@router.get("/recordings/{recording_id}/files/{export_name}")
def download_static_recording_export(recording_id: str, export_name: str):
    if export_name not in (*STATIC_EXPORT_FILES, "annotated_video"):
        raise HTTPException(status_code=404, detail="Unknown export")
    recording = next(
        (
            item for item in _discover_annotated_recordings(include_internal=True)
            if item["recording_id"] == recording_id and item["available"]
        ),
        None,
    )
    if recording is None:
        raise HTTPException(status_code=404, detail="Annotated recording not found")
    path = _static_export_path(recording, export_name)
    if path is None:
        raise HTTPException(status_code=404, detail="Requested export is not available")
    is_video = export_name == "annotated_video"
    return FileResponse(
        path,
        media_type="video/mp4" if is_video else "application/octet-stream",
        filename=path.name,
        content_disposition_type="inline" if is_video else "attachment",
    )


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def upload_and_start_video(
    file: UploadFile = File(...),
    camera_id: str = Form("uploaded-video"),
    counting_line: Optional[str] = Form(None),
    confidence_threshold: float = Form(0.35),
):
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Upload an MP4, MOV, AVI, or MKV video")
    content_type = (file.content_type or "").split(";", 1)[0].strip().lower()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES[extension]:
        raise HTTPException(
            status_code=415,
            detail=f"Content type {content_type!r} does not match the {extension[1:].upper()} video extension",
        )
    if not 0.05 <= confidence_threshold <= 0.95:
        raise HTTPException(status_code=422, detail="confidence_threshold must be between 0.05 and 0.95")
    line = _parse_counting_line(counting_line)

    session_id = str(uuid.uuid4())
    upload_dir = DATA_DIR / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename or "recording.mp4").name
    video_path = upload_dir / f"{session_id}{extension}"
    total_bytes = 0
    try:
        with video_path.open("wb") as target:
            while chunk := await file.read(1024 * 1024):
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Video exceeds the configured upload limit")
                target.write(chunk)
    except Exception:
        video_path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        cap.release()
        video_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="The uploaded file is not a readable video")
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
    frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()
    if min(width, height, frames) <= 0 or fps <= 0 or fps > 240:
        video_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="The uploaded video has invalid frame metadata")
    if line and any(not (0 <= x < width and 0 <= y < height) for x, y in line):
        video_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="Counting-line points must lie inside the video frame")

    create_video_session(
        session_id=session_id,
        video_name=safe_name,
        camera_id=camera_id,
        video_source_path=str(video_path),
        total_frames=frames,
        fps=fps,
        width=width,
        height=height,
        counting_line_json=json.dumps(line) if line else None,
    )
    try:
        video_processing_manager.start(
            session_id,
            str(video_path),
            camera_id,
            line,
            confidence_threshold,
        )
    except Exception as exc:
        update_video_session(session_id, status="FAILED", is_partial=1, error_message=str(exc))
        raise HTTPException(status_code=503, detail=f"Unable to start processing: {exc}") from exc
    return {
        "session_id": session_id,
        "status": "PROCESSING",
        "video_filename": safe_name,
        "source_width": width,
        "source_height": height,
        "source_fps": fps,
        "total_frames": frames,
        "data_source": "RECORDED VIDEO",
        "model_id": "configured-yolo-onnx",
        "supported_categories": [
            "TWO-WHEELER", "FOUR-WHEELER", "BUS", "TRUCK", "BICYCLE", "PEDESTRIAN"
        ],
        "unavailable_categories": ["THREE-WHEELER"],
    }


@router.get("/{session_id}")
def get_processing_status(session_id: str):
    session = get_video_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Processing session not found")
    response = _session_response(session)
    response["exports"] = {
        export_name: f"/api/video-processing/{session_id}/files/{export_name}"
        for export_name, column in EXPORT_COLUMNS.items()
        if session.get(column)
    }
    if session.get("processing_summary_json") and os.path.isfile(session["processing_summary_json"]):
        with open(session["processing_summary_json"], encoding="utf-8") as file:
            response["summary"] = json.load(file)
    response["minute_counts"] = get_video_minute_counts(session_id)
    return response


@router.post("/{session_id}/pause")
def pause_processing(session_id: str):
    try:
        video_processing_manager.pause(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"session_id": session_id, "status": "PAUSED"}


@router.post("/{session_id}/resume")
def resume_processing(session_id: str):
    try:
        video_processing_manager.resume(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"session_id": session_id, "status": "PROCESSING"}


@router.post("/{session_id}/stop")
def stop_processing(session_id: str):
    try:
        video_processing_manager.stop(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"session_id": session_id, "status": "STOPPING"}


@router.get("/{session_id}/files/{export_name}")
def download_export(session_id: str, export_name: str):
    column = EXPORT_COLUMNS.get(export_name)
    if column is None:
        raise HTTPException(status_code=404, detail="Unknown export")
    session = get_video_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Processing session not found")
    path = session.get(column)
    if not path or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Requested export is not ready")
    output_root = os.path.realpath(OUTPUT_DIR)
    resolved = os.path.realpath(path)
    if os.path.commonpath([output_root, resolved]) != output_root:
        raise HTTPException(status_code=404, detail="Export path is invalid")
    is_video = export_name == "annotated_video"
    return FileResponse(
        resolved,
        media_type="video/mp4" if is_video else "application/octet-stream",
        filename=os.path.basename(resolved),
        content_disposition_type="inline" if is_video else "attachment",
    )
