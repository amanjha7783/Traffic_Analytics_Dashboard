import json
import os
import uuid
from pathlib import Path
from typing import Optional, Tuple

import cv2
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.config import DATA_DIR, MAX_UPLOAD_BYTES, MODEL_PATH, OUTPUT_DIR
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

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv"}
EXPORT_COLUMNS = {
    "annotated_video": "annotated_video_path",
    "count_summary": "count_summary_csv",
    "track_details": "track_details_csv",
    "minute_counts": "minute_wise_csv",
    "processing_summary": "processing_summary_json",
}


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
        raise HTTPException(status_code=404, detail="No completed annotated video is available")
    session["exports"] = {
        export_name: f"/api/video-processing/{session['session_id']}/files/{export_name}"
        for export_name, column in EXPORT_COLUMNS.items()
        if session.get(column)
    }
    summary_path = session.get("processing_summary_json")
    if summary_path and os.path.isfile(summary_path):
        with open(summary_path, encoding="utf-8") as file:
            session["summary"] = json.load(file)
    return session


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
    session["exports"] = {
        export_name: f"/api/video-processing/{session_id}/files/{export_name}"
        for export_name, column in EXPORT_COLUMNS.items()
        if session.get(column)
    }
    if session.get("processing_summary_json") and os.path.isfile(session["processing_summary_json"]):
        with open(session["processing_summary_json"], encoding="utf-8") as file:
            session["summary"] = json.load(file)
    session["minute_counts"] = get_video_minute_counts(session_id)
    return session


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
