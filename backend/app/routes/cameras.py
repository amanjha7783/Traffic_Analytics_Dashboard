from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from fastapi.responses import StreamingResponse

from app.database.database import get_db_connection
from app.services.live_camera_manager import live_camera_manager
from app.vision.camera_manager import camera_manager

router = APIRouter()


class CameraConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    junction: str = Field(min_length=1, max_length=160)
    code: str = Field(min_length=1, max_length=40)
    video_source: Literal["rtsp", "local", "sample", "webcam"] = "rtsp"
    file_path: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    fps: Optional[float] = Field(default=None, gt=0, le=240)
    resolution: Optional[str] = Field(default=None, max_length=32)
    direction: Optional[str] = Field(default=None, max_length=80)


class CameraUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    junction: Optional[str] = Field(default=None, min_length=1, max_length=160)
    code: Optional[str] = Field(default=None, min_length=1, max_length=40)
    video_source: Optional[Literal["rtsp", "local", "sample", "webcam"]] = None
    file_path: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    fps: Optional[float] = Field(default=None, gt=0, le=240)
    resolution: Optional[str] = Field(default=None, max_length=32)
    direction: Optional[str] = Field(default=None, max_length=80)


@router.get("")
def list_cameras():
    return {"cameras": camera_manager.get_all_cameras()}


@router.get("/status")
def camera_status():
    return {
        "cameras": [
            {"id": camera["id"], "status": camera["status"]}
            for camera in camera_manager.get_all_cameras()
        ]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_camera(config: CameraConfig):
    values = config.model_dump()
    if values["video_source"] in ("local", "sample") and not values["file_path"]:
        raise HTTPException(status_code=422, detail="A local video path is required for this source")
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        try:
            conn.execute(
                """
                INSERT INTO cameras (
                    id, name, junction, code, video_source, file_path,
                    latitude, longitude, fps, resolution, direction, status,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISCONNECTED', ?, ?)
                """,
                (
                    values["id"], values["name"], values["junction"], values["code"],
                    values["video_source"], values["file_path"], values["latitude"],
                    values["longitude"], values["fps"], values["resolution"],
                    values["direction"], now, now,
                ),
            )
        except Exception as exc:
            if "UNIQUE constraint failed" in str(exc):
                raise HTTPException(status_code=409, detail="Camera ID already exists") from exc
            raise
    return camera_manager.get_camera(values["id"])


@router.get("/{camera_id}")
def get_camera(camera_id: str):
    camera = camera_manager.get_camera(camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


@router.put("/{camera_id}")
def update_camera(camera_id: str, updates: CameraUpdate):
    if camera_manager.get_camera(camera_id) is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    values = updates.model_dump(exclude_unset=True)
    if "file_path" in values and values["file_path"] is None:
        values["file_path"] = ""
    if not values:
        return camera_manager.get_camera(camera_id)
    camera_manager.stop_stream(camera_id)
    values["updated_at"] = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        fields = ", ".join(f"{key} = ?" for key in values)
        conn.execute(
            f"UPDATE cameras SET {fields} WHERE id = ?",
            (*values.values(), camera_id),
        )
    return camera_manager.get_camera(camera_id)


@router.post("/{camera_id}/start")
def start_camera(camera_id: str):
    try:
        worker = live_camera_manager.start(camera_id)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except KeyError:
        raise HTTPException(status_code=404, detail="Camera not found")
    return worker.snapshot()


@router.post("/{camera_id}/stop")
def stop_camera(camera_id: str):
    if camera_manager.get_camera(camera_id) is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    live_camera_manager.stop(camera_id)
    return {"camera_id": camera_id, "status": "DISCONNECTED"}


@router.get("/{camera_id}/metrics")
def get_camera_metrics(camera_id: str):
    worker = live_camera_manager.get(camera_id)
    if worker is None:
        camera = camera_manager.get_camera(camera_id)
        if camera is None:
            raise HTTPException(status_code=404, detail="Camera not found")
        return {
            "camera_id": camera_id,
            "status": "DISCONNECTED",
            "category_counts": {},
            "data_source": "UNAVAILABLE",
            "is_demo_data": False,
        }
    return worker.snapshot()


@router.get("/{camera_id}/stream")
def get_camera_stream(camera_id: str):
    worker = live_camera_manager.get(camera_id)
    if worker is None or worker.thread is None or not worker.thread.is_alive():
        raise HTTPException(status_code=409, detail="Start camera processing before opening its feed")
    return StreamingResponse(
        live_camera_manager.stream(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
