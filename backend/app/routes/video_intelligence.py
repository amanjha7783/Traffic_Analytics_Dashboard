"""
REST API Routes for Video Intelligence Studio.
Provides full CRUD and operational endpoints for Projects, Multi-Camera Video Ingestion,
First-Frame Calibration, Homography Estimation, Physical Region Measurement,
Background Video Processing Jobs, Telemetry Analytics, Multi-Camera Comparison,
and DataFromSky Import / Export Pipelines.
"""
import os
import json
import uuid
import math
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pathlib import Path
import cv2
import numpy as np


from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, Request, status
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

from app.database.database import get_db
from app.video_intelligence.upload_service import save_uploaded_video
from app.video_intelligence.homography import compute_robust_homography, transform_image_to_ground
from app.video_intelligence.geospatial import wgs84_to_utm
from app.video_intelligence.area_calculator import measure_region_geometry
from app.video_intelligence.density_engine import generate_heatmap_grid
from app.video_intelligence.workers.video_worker import job_manager
from app.video_intelligence.datafromsky_adapter import DataFromSkyAdapter

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic Schemas for Requests
# ---------------------------------------------------------------------------

class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = ""
    location: Optional[str] = "Vadodara Central Corridor"
    city: Optional[str] = "Vadodara"
    state: Optional[str] = "Gujarat"
    country: Optional[str] = "India"
    road_name: Optional[str] = "Pratapnagar Main Arterial Road"
    latitude: Optional[float] = 22.2988
    longitude: Optional[float] = 73.1950
    crs: Optional[str] = "EPSG:32643 (WGS 84 / UTM Zone 43N)"


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    road_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    crs: Optional[str] = None


class GCPPoint(BaseModel):
    id: str
    image_x: float
    image_y: float
    latitude: float
    longitude: float
    ground_x: Optional[float] = None
    ground_y: Optional[float] = None


class CalibrationSaveRequest(BaseModel):
    gcps: List[GCPPoint]


class RegionCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    region_type: str = Field(default="MONITORED_ROAD")
    vertices_pixel: List[List[float]] = Field(..., min_length=3)
    color_hex: Optional[str] = "#315B8A"


class RegionPreviewRequest(BaseModel):
    vertices_pixel: List[List[float]] = Field(..., min_length=3)




class ProcessJobRequest(BaseModel):
    confidence_threshold: Optional[float] = 0.35
    iou_threshold: Optional[float] = 0.45
    frame_step: Optional[int] = 1
    max_frames: Optional[int] = None
    generate_annotated_video: Optional[bool] = True
    backend: Optional[str] = "auto"
    precision: Optional[str] = "fp32"
    batch_size: Optional[int] = 4
    use_hardware_codec: Optional[bool] = True


# ---------------------------------------------------------------------------
# 1. Projects Endpoints
# ---------------------------------------------------------------------------

@router.get("/projects")
def list_projects():
    """List all traffic intelligence analysis projects with summary counts."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT p.id, p.name, p.description, p.location, p.city, p.state, p.country,
                   p.road_name, p.latitude, p.longitude, p.crs, p.status, p.created_at, p.updated_at,
                   COUNT(v.id) AS video_count,
                   SUM(CASE WHEN v.status = 'analyzed' THEN 1 ELSE 0 END) AS analyzed_count
            FROM studio_projects p
            LEFT JOIN studio_videos v ON p.id = v.project_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
            """
        )
        rows = cursor.fetchall()

    projects = []
    for r in rows:
        projects.append({
            "id": r[0],
            "name": r[1],
            "description": r[2],
            "location": r[3],
            "city": r[4],
            "state": r[5],
            "country": r[6],
            "road_name": r[7],
            "latitude": r[8],
            "longitude": r[9],
            "crs": r[10],
            "status": r[11],
            "created_at": r[12],
            "updated_at": r[13],
            "video_count": r[14],
            "analyzed_count": r[15] or 0,
        })
    return {"projects": projects, "total": len(projects)}


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(req: ProjectCreateRequest):
    """Create a new traffic analysis project workspace."""
    project_id = f"proj-{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO studio_projects (
                id, name, description, location, city, state, country,
                road_name, latitude, longitude, crs, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
            """,
            (
                project_id,
                req.name,
                req.description,
                req.location,
                req.city,
                req.state,
                req.country,
                req.road_name,
                req.latitude,
                req.longitude,
                req.crs,
                now_iso,
                now_iso,
            ),
        )
        conn.commit()

    return {"project_id": project_id, "message": "Project created successfully."}


@router.get("/projects/{project_id}")
def get_project(project_id: str):
    """Retrieve project metadata, associated videos, and calibrations."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM studio_projects WHERE id = ?", (project_id,))
        p = cursor.fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Project not found")

        cursor.execute(
            """
            SELECT id, camera_id, name, filename, duration_seconds,
                   fps, width, height, total_frames, file_size_bytes, status,
                   created_at, analysis_summary_json
            FROM studio_videos
            WHERE project_id = ?
            ORDER BY created_at ASC
            """,
            (project_id,),
        )
        videos = []
        for v in cursor.fetchall():
            summary = json.loads(v[12]) if v[12] else None
            videos.append({
                "id": v[0],
                "camera_id": v[1],
                "name": v[2],
                "filename": v[3],
                "duration_seconds": v[4],
                "fps": v[5],
                "width": v[6],
                "height": v[7],
                "total_frames": v[8],
                "file_size_bytes": v[9],
                "status": v[10],
                "created_at": v[11],
                "analysis_summary": summary,
            })

    return {
        "id": p["id"],
        "name": p["name"],
        "description": p["description"],
        "location": p["location"],
        "city": p["city"],
        "state": p["state"],
        "country": p["country"],
        "road_name": p["road_name"],
        "latitude": p["latitude"],
        "longitude": p["longitude"],
        "crs": p["crs"],
        "status": p["status"],
        "created_at": p["created_at"],
        "updated_at": p["updated_at"],
        "videos": videos,
    }


@router.delete("/projects/{project_id}")
def delete_project(project_id: str):
    """Delete a project and its records from database."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM studio_projects WHERE id = ?", (project_id,))
        conn.commit()
    return {"message": f"Project {project_id} deleted successfully."}


# ---------------------------------------------------------------------------
# 2. Multi-Video Upload & Streaming
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/videos/upload")
async def upload_video(
    project_id: str,
    file: UploadFile = File(...),
    camera_id: str = Form("CAM-01"),
    title: Optional[str] = Form(None),
):
    """
    Upload a CCTV traffic video (MP4, MOV, AVI, MKV).
    Extracts metadata via OpenCV, extracts first frame, creates thumbnail,
    and initializes project record.
    """
    # Verify project exists
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM studio_projects WHERE id = ?", (project_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Target project not found")

    try:
        res = save_uploaded_video(
            project_id=project_id,
            filename=file.filename or "traffic_feed.mp4",
            file_obj=file.file,
            camera_id=camera_id,
            name=title or file.filename or f"Camera {camera_id}",
        )
        return {"video": res, "message": "Video uploaded and ingested successfully."}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        logger.error(f"Failed to process video upload: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Upload processing failed: {exc}")


@router.get("/projects/{project_id}/videos")
def list_project_videos(project_id: str):
    """List all videos belonging to a project."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT v.id, v.camera_id, v.name, v.filename, v.duration_seconds,
                   v.fps, v.width, v.height, v.total_frames, v.file_size_bytes, v.status,
                   v.created_at, v.analysis_summary_json, c.quality_status, c.reprojection_rmse_m
            FROM studio_videos v
            LEFT JOIN studio_calibrations c ON v.id = c.video_id
            WHERE v.project_id = ?
            ORDER BY v.created_at ASC
            """,
            (project_id,),
        )
        rows = cursor.fetchall()

    videos = []
    for r in rows:
        summary = json.loads(r[12]) if r[12] else None
        is_cal = r[13] is not None and r[13] != "UNCOMMITTED"
        videos.append({
            "id": r[0],
            "camera_id": r[1],
            "title": r[2],
            "original_filename": r[3],
            "duration_seconds": r[4],
            "fps": r[5],
            "width": r[6],
            "height": r[7],
            "frame_count": r[8],
            "file_size_bytes": r[9],
            "status": r[10],
            "created_at": r[11],
            "analysis_summary": summary,
            "is_calibrated": is_cal,
            "calibration_quality": r[13] or "UNCALIBRATED",
            "reprojection_rmse_m": r[14],
        })
    return {"videos": videos, "total": len(videos)}


@router.get("/videos/{video_id}")
def get_video_details(video_id: str):
    """Retrieve full metadata for an individual video source."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT v.*, c.quality_status, c.reprojection_rmse_m
            FROM studio_videos v
            LEFT JOIN studio_calibrations c ON v.id = c.video_id
            WHERE v.id = ?
            """,
            (video_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Video not found")

    is_cal = row["quality_status"] is not None and row["quality_status"] != "UNCOMMITTED"
    ann_path = row["annotated_video_path"] if "annotated_video_path" in row.keys() else None

    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "camera_id": row["camera_id"],
        "title": row["name"],
        "original_filename": row["filename"],
        "duration_seconds": row["duration_seconds"],
        "fps": row["fps"],
        "width": row["width"],
        "height": row["height"],
        "frame_count": row["total_frames"],
        "total_frames": row["total_frames"],
        "file_size_bytes": row["file_size_bytes"],
        "status": row["status"],
        "created_at": row["created_at"],
        "is_calibrated": is_cal,
        "reprojection_rmse_m": row["reprojection_rmse_m"],
        "calibration_quality": row["quality_status"] or "UNCALIBRATED",
        "analysis_summary": json.loads(row["analysis_summary_json"]) if "analysis_summary_json" in row.keys() and row["analysis_summary_json"] else None,
        "has_annotated_video": bool(ann_path and os.path.exists(ann_path)),
    }


class VideoRenameRequest(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None


@router.patch("/videos/{video_id}")
def update_video_name(video_id: str, req: VideoRenameRequest):
    """Update display title / name of a video."""
    new_name = req.name or req.title
    if not new_name or not new_name.strip():
        raise HTTPException(status_code=400, detail="A non-empty name or title must be provided.")
    new_name = new_name.strip()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE studio_videos SET name = ? WHERE id = ?", (new_name, video_id))
        conn.commit()
    return {"id": video_id, "name": new_name, "message": "Video name updated successfully."}


@router.delete("/videos/{video_id}")
def delete_video(video_id: str):
    """Delete a video and clean up database rows."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT file_path FROM studio_videos WHERE id = ?", (video_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Video not found")

        cursor.execute("DELETE FROM studio_videos WHERE id = ?", (video_id,))
        conn.commit()

    return {"message": f"Video {video_id} removed successfully."}


@router.get("/videos/{video_id}/first-frame")
def get_video_first_frame(video_id: str):
    """Stream first frame JPEG extracted during video upload."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT first_frame_path FROM studio_videos WHERE id = ?", (video_id,))
        row = cursor.fetchone()
        if not row or not row[0] or not os.path.exists(row[0]):
            raise HTTPException(status_code=404, detail="First frame image not found.")
        return FileResponse(row[0], media_type="image/jpeg")


@router.get("/videos/{video_id}/thumbnail")
def get_video_thumbnail(video_id: str):
    """Stream thumbnail JPEG."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT thumbnail_path FROM studio_videos WHERE id = ?", (video_id,))
        row = cursor.fetchone()
        if not row or not row[0] or not os.path.exists(row[0]):
            raise HTTPException(status_code=404, detail="Thumbnail image not found.")
        return FileResponse(row[0], media_type="image/jpeg")


def range_stream_video(file_path: str, range_header: Optional[str] = None) -> Response:
    """Stream video file with support for HTTP 206 byte-range seeking and web player compatibility."""
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Video file not found.")

    file_size = os.path.getsize(file_path)

    if not range_header:
        return FileResponse(
            file_path,
            media_type="video/mp4",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
            },
        )

    try:
        range_val = range_header.strip().replace("bytes=", "")
        parts = range_val.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Range header format.")

    if start >= file_size or end >= file_size or start > end:
        return Response(
            status_code=416,
            headers={
                "Content-Range": f"bytes */{file_size}",
                "Accept-Ranges": "bytes",
            },
        )

    chunk_size = end - start + 1

    def iter_file():
        with open(file_path, "rb") as f:
            f.seek(start)
            remaining = chunk_size
            while remaining > 0:
                read_len = min(128 * 1024, remaining)
                data = f.read(read_len)
                if not data:
                    break
                remaining -= len(data)
                yield data

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": "video/mp4",
        "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
    }
    return StreamingResponse(iter_file(), status_code=206, headers=headers)


@router.get("/videos/{video_id}/stream")
def stream_original_video(video_id: str, request: Request):
    """Stream original source video file with HTTP Range support."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT file_path FROM studio_videos WHERE id = ?", (video_id,))
        row = cursor.fetchone()
        if not row or not row[0] or not os.path.exists(row[0]):
            raise HTTPException(status_code=404, detail="Video file not found.")
        return range_stream_video(row[0], request.headers.get("Range"))


@router.get("/videos/{video_id}/annotated-stream")
def stream_annotated_video(video_id: str, request: Request):
    """Stream YOLO-annotated video file with graceful fallback to original feed and HTTP Range support."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT annotated_video_path, file_path FROM studio_videos WHERE id = ?", (video_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Video not found.")
        ann_path = row[0]
        orig_path = row[1]

        if ann_path and os.path.exists(ann_path):
            return range_stream_video(ann_path, request.headers.get("Range"))
        if orig_path and os.path.exists(orig_path):
            return range_stream_video(orig_path, request.headers.get("Range"))
        raise HTTPException(status_code=404, detail="Annotated video not found or not yet generated.")


# ---------------------------------------------------------------------------
# 3. Calibration Studio & Homography
# ---------------------------------------------------------------------------

@router.get("/videos/{video_id}/calibration")
def get_calibration(video_id: str):
    """Retrieve ground-control points and planar homography status."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM studio_calibrations WHERE video_id = ?", (video_id,))
        row = cursor.fetchone()
        if not row:
            return {
                "video_id": video_id,
                "is_calibrated": False,
                "gcps": [],
                "homography_matrix": None,
                "reprojection_rmse_m": None,
                "calibration_quality": "UNCALIBRATED",
            }

        gcps = json.loads(row["ground_control_points_json"]) if row["ground_control_points_json"] else []
        h_matrix = json.loads(row["homography_matrix_json"]) if row["homography_matrix_json"] else None
        quality = row["quality_status"] or "UNCALIBRATED"
        is_cal = quality != "UNCOMMITTED" and quality != "UNCALIBRATED" and h_matrix is not None

        return {
            "id": row["id"],
            "video_id": row["video_id"],
            "project_id": row["project_id"],
            "is_calibrated": is_cal,
            "gcps": gcps,
            "homography_matrix": h_matrix,
            "reprojection_rmse_m": row["reprojection_rmse_m"],
            "calibration_quality": quality,
            "calibrated_at": row["calibrated_at"],
        }


@router.post("/videos/{video_id}/calibration")
def save_calibration(video_id: str, req: CalibrationSaveRequest):
    """
    Save Ground Control Points (GCPs) and compute planar homography matrix using RANSAC.
    Calculates reprojection RMSE in meters and rates calibration quality.
    """
    if len(req.gcps) < 4:
        raise HTTPException(
            status_code=400,
            detail="Planar homography requires at least 4 non-collinear Ground Control Points."
        )

    # Fetch project origin for metric UTM projection
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT p.id, p.latitude, p.longitude, v.width, v.height
            FROM studio_videos v
            JOIN studio_projects p ON v.project_id = p.id
            WHERE v.id = ?
            """,
            (video_id,),
        )
        proj_row = cursor.fetchone()
        if not proj_row:
            raise HTTPException(status_code=404, detail="Video or associated project not found.")

        project_id = proj_row[0]
        ref_lat = proj_row[1] or 22.2988
        ref_lon = proj_row[2] or 73.1950
        v_w = proj_row[3] or 1920
        v_h = proj_row[4] or 1080

    # Format GCP dicts and compute metric ground coords relative to project origin
    gcp_dicts = [g.model_dump() for g in req.gcps]
    ref_easting, ref_northing, _, _ = wgs84_to_utm(ref_lat, ref_lon)

    image_points = []
    ground_points_m = []

    for g in gcp_dicts:
        image_points.append([float(g["image_x"]), float(g["image_y"])])
        if g.get("ground_x") is not None and g.get("ground_y") is not None:
            gx = float(g["ground_x"])
            gy = float(g["ground_y"])
        else:
            e, n, _, _ = wgs84_to_utm(float(g["latitude"]), float(g["longitude"]))
            gx = round(e - ref_easting, 3)
            gy = round(n - ref_northing, 3)
            g["ground_x"] = gx
            g["ground_y"] = gy
        ground_points_m.append([gx, gy])

    try:
        h_result = compute_robust_homography(
            image_points=image_points,
            ground_points_m=ground_points_m,
        )
    except Exception as exc:
        logger.error(f"Homography estimation failed: {exc}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Calibration estimation failed: {exc}")

    rmse = h_result.get("reprojection_rmse_m", 99.0)
    quality = h_result.get("quality_status", "MODERATE")
    h_matrix = h_result.get("homography_matrix")
    updated_gcps = gcp_dicts

    # Persist calibration
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO studio_calibrations (
                id, video_id, project_id, homography_matrix_json, reprojection_rmse_m,
                inlier_count, quality_status, ground_control_points_json, source_width, source_height,
                calibrated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                f"calib-{video_id[:8]}",
                video_id,
                project_id,
                json.dumps(h_matrix),
                rmse,
                len(req.gcps),
                quality,
                json.dumps(updated_gcps),
                v_w,
                v_h,
            ),
        )
        conn.commit()

    return {
        "video_id": video_id,
        "is_calibrated": True,
        "reprojection_rmse_m": rmse,
        "calibration_quality": quality,
        "homography_matrix": h_matrix,
        "gcps": updated_gcps,
        "message": f"Calibration successful with RMSE {rmse}m ({quality}).",
    }


# ---------------------------------------------------------------------------
# 4. Monitored Road Regions
# ---------------------------------------------------------------------------

@router.get("/videos/{video_id}/regions")
def list_regions(video_id: str):
    """List monitored measurement polygons for a video."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM studio_regions WHERE video_id = ? ORDER BY created_at ASC", (video_id,))
        rows = cursor.fetchall()

    regions = []
    for r in rows:
        regions.append({
            "id": r["id"],
            "video_id": r["video_id"],
            "project_id": r["project_id"],
            "name": r["name"],
            "region_type": r["region_type"],
            "vertices_pixel": json.loads(r["vertices_pixel_json"]) if r["vertices_pixel_json"] else [],
            "area_sqm": r["area_m2"],
            "perimeter_m": r["perimeter_m"],
            "road_width_m": r["road_width_m"],
            "color_hex": r["color_hex"] if "color_hex" in r.keys() else "#315B8A",
            "created_at": r["created_at"],
        })
    return {"regions": regions, "total": len(regions)}


@router.post("/videos/{video_id}/regions", status_code=status.HTTP_201_CREATED)
def create_region(video_id: str, req: RegionCreateRequest):
    """
    Create a new monitored road polygon.
    Automatically computes real-world area (m²), perimeter (m), and road width (m)
    via calibrated homography.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT v.project_id, c.homography_matrix_json
            FROM studio_videos v
            LEFT JOIN studio_calibrations c ON v.id = c.video_id
            WHERE v.id = ?
            """,
            (video_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Video not found")

        project_id = row[0]
        h_matrix = json.loads(row[1]) if row[1] else None

    if not h_matrix:
        raise HTTPException(
            status_code=400,
            detail="Camera calibration is required before defining a physical road measurement area. Please calibrate GCPs first."
        )

    # Calculate real-world physical dimensions with topological validation
    metrics = measure_region_geometry(req.vertices_pixel, h_matrix)
    if not metrics.get("is_valid"):
        raise HTTPException(
            status_code=400,
            detail=metrics.get("error", "Invalid polygon geometry. Vertices must not self-intersect and must enclose a non-zero area.")
        )

    region_id = f"reg-{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        # Clean up any existing region of the same type for this video to prevent duplicate regions
        cursor.execute("DELETE FROM studio_regions WHERE video_id = ? AND region_type = ?", (video_id, req.region_type))
        cursor.execute(
            """
            INSERT INTO studio_regions (
                id, video_id, project_id, name, region_type, vertices_pixel_json,
                vertices_ground_json, area_m2, perimeter_m, road_width_m, color_hex, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                region_id,
                video_id,
                project_id,
                req.name,
                req.region_type,
                json.dumps(req.vertices_pixel),
                json.dumps(metrics.get("vertices_ground", [])),
                metrics["area_m2"],
                metrics["perimeter_m"],
                metrics["road_width_m"],
                req.color_hex or "#315B8A",
                now_iso,
            ),
        )
        conn.commit()

    return {
        "region_id": region_id,
        "name": req.name,
        "region_type": req.region_type,
        "area_sqm": metrics["area_m2"],
        "perimeter_m": metrics["perimeter_m"],
        "road_width_m": metrics["road_width_m"],
        "vertices_ground": metrics.get("vertices_ground", []),
        "message": "Road measurement region saved with physical dimensions calculated.",
    }


@router.post("/videos/{video_id}/regions/preview")
def preview_region(video_id: str, req: RegionPreviewRequest):
    """
    Live preview real-world physical dimensions and topological validity
    for an in-progress polygon using existing camera calibration.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT c.homography_matrix_json
            FROM studio_videos v
            LEFT JOIN studio_calibrations c ON v.id = c.video_id
            WHERE v.id = ?
            """,
            (video_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Video not found")

        h_matrix = json.loads(row[0]) if row and row[0] else None

    metrics = measure_region_geometry(req.vertices_pixel, h_matrix)
    return metrics



@router.delete("/regions/{region_id}")
def delete_region(region_id: str):
    """Delete a monitored road region."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM studio_regions WHERE id = ?", (region_id,))
        conn.commit()
    return {"message": f"Region {region_id} deleted."}


# ---------------------------------------------------------------------------
# 5. Background Video Processing Jobs
# ---------------------------------------------------------------------------

@router.post("/videos/{video_id}/process")
def start_processing_job(video_id: str, req: ProcessJobRequest):
    """Launch background video processing pipeline (YOLOv8 + ByteTrack + Homography)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT project_id, file_path FROM studio_videos WHERE id = ?", (video_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Video not found")
        project_id = row[0]

    job_id = job_manager.start_job(
        video_id=video_id,
        project_id=project_id,
        config=req.model_dump(),
    )
    return {
        "job_id": job_id,
        "video_id": video_id,
        "project_id": project_id,
        "status": "PENDING",
    }


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    """Retrieve live processing progress, current frame, FPS, and ETA."""
    status_info = job_manager.get_job_status(job_id)
    if not status_info:
        raise HTTPException(status_code=404, detail="Processing job not found.")
    return status_info


@router.post("/jobs/{job_id}/pause")
def pause_job(job_id: str):
    """Pause an active processing job."""
    ok = job_manager.pause_job(job_id)
    return {"success": ok, "job_id": job_id, "status": "paused" if ok else "not_running"}


@router.post("/jobs/{job_id}/resume")
def resume_job(job_id: str):
    """Resume a paused processing job."""
    ok = job_manager.resume_job(job_id)
    return {"success": ok, "job_id": job_id, "status": "processing" if ok else "not_paused"}


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    """Cancel a processing job."""
    ok = job_manager.cancel_job(job_id)
    return {"success": ok, "job_id": job_id, "status": "cancelled"}


@router.get("/projects/{project_id}/jobs")
def list_project_jobs(project_id: str):
    """List all processing jobs for a project."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT j.*, v.name AS video_title
            FROM studio_processing_jobs j
            JOIN studio_videos v ON j.video_id = v.id
            WHERE j.project_id = ?
            ORDER BY j.created_at DESC
            """,
            (project_id,),
        )
        rows = cursor.fetchall()

    jobs = []
    for r in rows:
        jobs.append({
            "id": r["id"],
            "video_id": r["video_id"],
            "video_title": r["video_title"],
            "status": r["status"],
            "progress_percent": r["progress_percent"],
            "current_frame": r["current_frame"],
            "total_frames": r["total_frames"],
            "processing_fps": r["fps"],
            "error_message": r["error_message"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        })
    return {"jobs": jobs}


# ---------------------------------------------------------------------------
# 6. Video Analytics & Trajectories
# ---------------------------------------------------------------------------

@router.get("/videos/{video_id}/analytics")
def get_video_analytics(video_id: str):
    """Retrieve detailed analytics KPIs, calibration presence, road area presence, and time-series measurements."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT analysis_summary_json FROM studio_videos WHERE id = ?", (video_id,))
        v_row = cursor.fetchone()
        summary = json.loads(v_row[0]) if v_row and v_row[0] else {}

        # 1. Calibration status check
        cursor.execute("SELECT homography_matrix_json FROM studio_calibrations WHERE video_id = ?", (video_id,))
        calib_row = cursor.fetchone()
        has_calibration = bool(calib_row and calib_row[0])

        # 2. Road measurement polygon area check
        cursor.execute(
            """
            SELECT id, name, region_type, vertices_pixel_json, vertices_ground_json, area_m2, perimeter_m, road_width_m
            FROM studio_regions
            WHERE video_id = ? AND area_m2 IS NOT NULL AND area_m2 > 0
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (video_id,),
        )
        region_row = cursor.fetchone()
        has_road_area = bool(region_row and region_row["area_m2"] and region_row["area_m2"] > 0)
        road_area_sqm = float(region_row["area_m2"]) if has_road_area else None
        road_perimeter_m = float(region_row["perimeter_m"]) if has_road_area and region_row["perimeter_m"] else None
        road_width_m = float(region_row["road_width_m"]) if has_road_area and region_row["road_width_m"] else None
        region_name = region_row["name"] if has_road_area else None
        poly_contour = None
        if has_road_area:
            try:
                poly_pts = json.loads(region_row["vertices_pixel_json"])
                if len(poly_pts) >= 3:
                    poly_contour = np.array(poly_pts, dtype=np.int32)
            except Exception as e:
                logger.warning(f"Failed to load polygon contour for analytics: {e}")

        # Standard IRC (Indian Roads Congress) vehicle ground footprints in m²
        vehicle_footprints = {
            "four-wheeler": 7.92,
            "car": 7.92,
            "van": 10.0,
            "truck": 24.0,
            "bus": 28.75,
            "two-wheeler": 1.52,
            "motorcycle": 1.52,
            "bicycle": 1.14,
            "pedestrian": 0.25,
            "auto-rickshaw": 3.38,
        }
        default_footprint = 7.92

        # 3. Unique vehicle classification distribution (COUNT(DISTINCT track_id))
        cursor.execute(
            """
            SELECT vehicle_class, COUNT(DISTINCT track_id)
            FROM studio_trajectories
            WHERE video_id = ?
            GROUP BY vehicle_class
            ORDER BY COUNT(DISTINCT track_id) DESC
            """,
            (video_id,),
        )
        unique_class_distribution = {r[0]: r[1] for r in cursor.fetchall()}
        total_unique_vehicles = sum(unique_class_distribution.values())

        summary["vehicle_class_distribution"] = unique_class_distribution
        summary["unique_class_distribution"] = unique_class_distribution
        summary["total_unique_vehicles"] = total_unique_vehicles
        summary["calibrated"] = has_calibration

        # 4. Construct time-series timeline from studio_trajectories
        cursor.execute(
            """
            SELECT MIN(timestamp_s), MAX(timestamp_s)
            FROM studio_trajectories
            WHERE video_id = ?
            """,
            (video_id,),
        )
        t_range = cursor.fetchone()
        min_t = t_range[0] if t_range and t_range[0] is not None else 0.0
        max_t = t_range[1] if t_range and t_range[1] is not None else 0.0

        cursor.execute(
            """
            SELECT track_id, timestamp_s, speed_kmh, vehicle_class, image_x, image_y
            FROM studio_trajectories
            WHERE video_id = ?
            ORDER BY timestamp_s ASC
            """,
            (video_id,),
        )
        all_pts = cursor.fetchall()

        timeline = []
        all_densities_sqkm = []
        all_occupancies_pct = []

        if all_pts:
            # Map track_id to its vehicle class
            track_class_map = {}
            for p in all_pts:
                tid = p["track_id"]
                if tid not in track_class_map:
                    track_class_map[tid] = p["vehicle_class"] or "four-wheeler"

            step_s = 1.0  # 1-second interval bins
            seen_tracks = set()
            t_curr = 0.0
            while t_curr <= max_t + 0.1:
                t_next = t_curr + step_s
                pts_in_bin = [p for p in all_pts if t_curr <= p["timestamp_s"] < t_next]
                active_tids = set(p["track_id"] for p in pts_in_bin)
                seen_tracks.update(active_tids)

                valid_speeds = [p["speed_kmh"] for p in pts_in_bin if p["speed_kmh"] is not None and p["speed_kmh"] > 0]
                avg_spd = round(sum(valid_speeds) / len(valid_speeds), 1) if valid_speeds else None

                # Calculate real physical density and road occupancy via point-in-polygon containment
                if has_road_area and road_area_sqm and poly_contour is not None:
                    # Filter observations whose ground reference point (bottom-center of bounding box) is inside the polygon
                    inside_tids = set(
                        p["track_id"] for p in pts_in_bin
                        if cv2.pointPolygonTest(poly_contour, (float(p["image_x"]), float(p["image_y"])), False) >= 0
                    )
                    inside_count = len(inside_tids)
                    density_m2 = round(inside_count / road_area_sqm, 6)
                    density_km2 = round(density_m2 * 1_000_000.0, 1)

                    # Estimate occupied vehicle footprint area on the ground plane
                    total_footprint = sum(
                        vehicle_footprints.get(track_class_map.get(tid, "four-wheeler").lower(), default_footprint)
                        for tid in inside_tids
                    )
                    occupancy_pct = min(100.0, round((total_footprint / road_area_sqm) * 100.0, 1))

                    all_densities_sqkm.append(density_km2)
                    all_occupancies_pct.append(occupancy_pct)
                else:
                    inside_count = 0
                    density_m2 = None
                    density_km2 = None
                    occupancy_pct = None

                timeline.append({
                    "timestamp_s": round(t_curr, 2),
                    "vehicle_count": len(active_tids),
                    "active_vehicles": len(active_tids),
                    "active_inside_region": inside_count if has_road_area else None,
                    "cumulative_unique_vehicles": len(seen_tracks),
                    "density_veh_sqm": density_m2,
                    "density_veh_sqkm": density_km2,
                    "road_occupancy_percent": occupancy_pct,
                    "avg_speed_kmh": avg_spd,
                    "has_valid_speed": avg_spd is not None,
                    "level_of_service": "LOS A" if (avg_spd and avg_spd >= 45) else ("LOS B" if (avg_spd and avg_spd >= 25) else "LOS C"),
                })
                t_curr += step_s

        density_stats = None
        if has_road_area and road_area_sqm:
            density_stats = {
                "avg_density_veh_sqkm": round(sum(all_densities_sqkm) / len(all_densities_sqkm), 1) if all_densities_sqkm else 0.0,
                "max_density_veh_sqkm": round(max(all_densities_sqkm), 1) if all_densities_sqkm else 0.0,
                "avg_occupancy_percent": round(sum(all_occupancies_pct) / len(all_occupancies_pct), 1) if all_occupancies_pct else 0.0,
                "max_occupancy_percent": round(max(all_occupancies_pct), 1) if all_occupancies_pct else 0.0,
                "road_area_sqm": road_area_sqm,
                "road_perimeter_m": road_perimeter_m,
                "road_width_m": road_width_m,
                "region_name": region_name,
                "calibration_status": "CALIBRATED" if has_calibration else "UNCALIBRATED",
                "methodology": "Ground-plane point-in-polygon reference tracking with IRC vehicle footprint estimation"
            }

    return {
        "video_id": video_id,
        "has_calibration": has_calibration,
        "has_road_area": has_road_area,
        "road_area_sqm": road_area_sqm,
        "density_stats": density_stats,
        "summary": summary,
        "timeline": timeline,
    }


@router.get("/observations/{observation_id}/frame")
@router.get("/videos/{video_id}/observations/{observation_id}/frame")
def get_observation_frame(observation_id: int, video_id: Optional[str] = None):
    """
    Extract and return the exact video frame for an observation,
    annotated with its detection bounding box, track ID, vehicle class, speed, and ground point.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT o.id, o.video_id, o.track_id, o.frame_idx, o.timestamp_s,
                   o.vehicle_class, o.confidence, o.bbox_x1, o.bbox_y1, o.bbox_x2, o.bbox_y2,
                   o.image_x, o.image_y, o.ground_x_m, o.ground_y_m, o.latitude, o.longitude, o.speed_kmh,
                   v.file_path, v.annotated_video_path
            FROM studio_trajectories o
            JOIN studio_videos v ON o.video_id = v.id
            WHERE o.id = ?
            """,
            (observation_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Observation not found.")

    v_path = row["file_path"]
    if not v_path or not os.path.exists(v_path):
        raise HTTPException(status_code=404, detail="Source video file not found.")

    # Open video and seek to frame
    cap = cv2.VideoCapture(v_path)
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail="Failed to open source video.")

    frame_idx = row["frame_idx"]
    timestamp_s = row["timestamp_s"]
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    if not ret or frame is None:
        # Fallback seek by millisecond timestamp
        cap.set(cv2.CAP_PROP_POS_MSEC, timestamp_s * 1000.0)
        ret, frame = cap.read()
    cap.release()

    if not ret or frame is None:
        raise HTTPException(status_code=404, detail="Could not read frame from video.")

    # Draw observation bounding box and telemetry
    x1, y1 = int(row["bbox_x1"]), int(row["bbox_y1"])
    x2, y2 = int(row["bbox_x2"]), int(row["bbox_y2"])
    cx, cy = int(row["image_x"]), int(row["image_y"])
    vclass = str(row["vehicle_class"]).upper()
    track_id = row["track_id"]
    spd = row["speed_kmh"]

    # Class colors (BGR)
    color_map = {
        "FOUR-WHEELER": (246, 130, 59),  # Electric Blue #3b82f6
        "PEDESTRIAN": (129, 185, 16),    # Emerald #10b981
        "BUS": (246, 92, 139),           # Purple #8b5cf6
        "TWO-WHEELER": (34, 197, 94),
        "TRUCK": (234, 88, 12),
    }
    box_color = color_map.get(vclass, (0, 215, 255))

    # Highlight bounding box
    cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 3)

    # Highlight ground contact point
    cv2.circle(frame, (cx, cy), 6, (0, 0, 255), -1)
    cv2.circle(frame, (cx, cy), 9, (255, 255, 255), 2)

    # Text overlay
    spd_txt = f"{spd:.1f} km/h" if spd is not None else "Calibrating"
    label = f"#{track_id} {vclass} | {spd_txt} | t={timestamp_s:.2f}s (f#{frame_idx})"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.65
    thickness = 2
    (tw, th), baseline = cv2.getTextSize(label, font, font_scale, thickness)

    bg_y1 = max(0, y1 - th - 12)
    bg_y2 = y1
    bg_x2 = min(frame.shape[1], x1 + tw + 16)
    cv2.rectangle(frame, (x1, bg_y1), (bg_x2, bg_y2), (15, 23, 42), -1)
    cv2.rectangle(frame, (x1, bg_y1), (bg_x2, bg_y2), box_color, 1)
    cv2.putText(frame, label, (x1 + 8, y1 - 6), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

    success, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode frame JPEG.")

    return Response(content=buffer.tobytes(), media_type="image/jpeg")


@router.get("/observations/{observation_id}")
def get_observation_details(observation_id: int):
    """Retrieve full metadata for a specific observation."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, video_id, project_id, track_id, frame_idx, timestamp_s,
                   vehicle_class, confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2,
                   image_x, image_y, ground_x_m, ground_y_m, latitude, longitude, speed_kmh
            FROM studio_trajectories
            WHERE id = ?
            """,
            (observation_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Observation not found.")

        return {
            "id": row["id"],
            "video_id": row["video_id"],
            "project_id": row["project_id"],
            "track_id": row["track_id"],
            "frame_idx": row["frame_idx"],
            "timestamp_s": round(row["timestamp_s"], 2),
            "vehicle_class": row["vehicle_class"],
            "confidence": round(row["confidence"], 3),
            "bbox": [round(row["bbox_x1"], 1), round(row["bbox_y1"], 1), round(row["bbox_x2"], 1), round(row["bbox_y2"], 1)],
            "image_x": round(row["image_x"], 1),
            "image_y": round(row["image_y"], 1),
            "ground_x_m": round(row["ground_x_m"], 2) if row["ground_x_m"] is not None else None,
            "ground_y_m": round(row["ground_y_m"], 2) if row["ground_y_m"] is not None else None,
            "latitude": round(row["latitude"], 6) if row["latitude"] is not None else None,
            "longitude": round(row["longitude"], 6) if row["longitude"] is not None else None,
            "speed_kmh": round(row["speed_kmh"], 1) if row["speed_kmh"] is not None else None,
        }


@router.get("/videos/{video_id}/trajectories")
def get_trajectories(
    video_id: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    vehicle_class: Optional[str] = None,
    track_id: Optional[int] = None,
):
    """Query paginated, filterable vehicle tracks and trajectory points."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Query vehicle tracks summary
        query_tracks = "SELECT * FROM studio_vehicle_tracks WHERE video_id = ?"
        params: List[Any] = [video_id]
        if vehicle_class:
            query_tracks += " AND vehicle_class = ?"
            params.append(vehicle_class)
        if track_id:
            query_tracks += " AND track_id = ?"
            params.append(track_id)

        query_tracks += " ORDER BY first_timestamp_s ASC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor.execute(query_tracks, params)
        track_rows = cursor.fetchall()

        tracks = []
        for t in track_rows:
            tracks.append({
                "id": t["id"],
                "track_id": t["track_id"],
                "vehicle_class": t["vehicle_class"],
                "first_detected_s": t["first_timestamp_s"],
                "last_detected_s": t["last_timestamp_s"],
                "duration_s": t["duration_s"],
                "avg_speed_kmh": t["avg_speed_kmh"],
                "max_speed_kmh": t["max_speed_kmh"],
                "total_distance_m": t["total_distance_m"] if "total_distance_m" in t.keys() else None,
            })

        # Count total tracks
        cursor.execute("SELECT COUNT(*) FROM studio_vehicle_tracks WHERE video_id = ?", (video_id,))
        total_tracks = cursor.fetchone()[0]

    return {"tracks": tracks, "total_tracks": total_tracks, "limit": limit, "offset": offset}


@router.get("/videos/{video_id}/trajectory-points")
def get_trajectory_points(
    video_id: str,
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    track_id: Optional[int] = None,
    vehicle_class: Optional[str] = None,
):
    """Query granular observation points from studio_trajectories."""
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT id, track_id, frame_idx, timestamp_s, vehicle_class, confidence,
                   bbox_x1, bbox_y1, bbox_x2, bbox_y2,
                   image_x, image_y, ground_x_m, ground_y_m, latitude, longitude, speed_kmh
            FROM studio_trajectories
            WHERE video_id = ?
        """
        params: List[Any] = [video_id]
        if track_id is not None:
            query += " AND track_id = ?"
            params.append(track_id)
        if vehicle_class:
            query += " AND vehicle_class = ?"
            params.append(vehicle_class)

        query += " ORDER BY timestamp_s ASC, track_id ASC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor.execute(query, params)
        rows = cursor.fetchall()

        points = []
        for r in rows:
            points.append({
                "id": r["id"],
                "track_id": r["track_id"],
                "frame_idx": r["frame_idx"],
                "timestamp_s": round(r["timestamp_s"], 2) if r["timestamp_s"] is not None else 0.0,
                "vehicle_class": r["vehicle_class"],
                "confidence": round(r["confidence"], 3) if "confidence" in r.keys() and r["confidence"] is not None else 0.85,
                "bbox": [r["bbox_x1"], r["bbox_y1"], r["bbox_x2"], r["bbox_y2"]] if "bbox_x1" in r.keys() else None,
                "image_x": round(r["image_x"], 1) if r["image_x"] is not None else 0.0,
                "image_y": round(r["image_y"], 1) if r["image_y"] is not None else 0.0,
                "ground_x_m": round(r["ground_x_m"], 2) if r["ground_x_m"] is not None else None,
                "ground_y_m": round(r["ground_y_m"], 2) if r["ground_y_m"] is not None else None,
                "latitude": round(r["latitude"], 6) if r["latitude"] is not None else None,
                "longitude": round(r["longitude"], 6) if r["longitude"] is not None else None,
                "speed_kmh": round(r["speed_kmh"], 1) if r["speed_kmh"] is not None else None,
            })

        count_query = "SELECT COUNT(*) FROM studio_trajectories WHERE video_id = ?"
        count_params: List[Any] = [video_id]
        if track_id is not None:
            count_query += " AND track_id = ?"
            count_params.append(track_id)
        if vehicle_class:
            count_query += " AND vehicle_class = ?"
            count_params.append(vehicle_class)
        cursor.execute(count_query, count_params)
        total = cursor.fetchone()[0]

    return {"points": points, "total": total, "limit": limit, "offset": offset}


@router.get("/videos/{video_id}/trajectories/csv")
def download_trajectories_csv(video_id: str):
    """Generate or stream CSV of trajectories for the video."""
    import csv
    import io
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT timestamp_s, track_id, vehicle_class, image_x, image_y,
                   ground_x_m, ground_y_m, latitude, longitude, speed_kmh
            FROM studio_trajectories
            WHERE video_id = ?
            ORDER BY timestamp_s ASC, track_id ASC
            """,
            (video_id,),
        )
        rows = cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "timestamp_s", "track_id", "vehicle_class", "image_x", "image_y",
        "ground_x_m", "ground_y_m", "latitude", "longitude", "speed_kmh"
    ])
    for r in rows:
        writer.writerow([
            round(r["timestamp_s"], 2) if r["timestamp_s"] is not None else "",
            r["track_id"],
            r["vehicle_class"],
            round(r["image_x"], 1) if r["image_x"] is not None else "",
            round(r["image_y"], 1) if r["image_y"] is not None else "",
            round(r["ground_x_m"], 2) if r["ground_x_m"] is not None else "",
            round(r["ground_y_m"], 2) if r["ground_y_m"] is not None else "",
            f"{r['latitude']:.6f}" if r["latitude"] is not None else "",
            f"{r['longitude']:.6f}" if r["longitude"] is not None else "",
            round(r["speed_kmh"], 1) if r["speed_kmh"] is not None else "",
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=trajectories_{video_id}.csv"}
    )



@router.get("/videos/{video_id}/heatmaps")
def get_heatmaps(video_id: str, grid_size: int = Query(30, ge=10, le=100)):
    """Generate 2D Gaussian density & speed spatial matrix for video."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT image_x, image_y, speed_kmh
            FROM studio_trajectories
            WHERE video_id = ? AND image_x IS NOT NULL AND image_y IS NOT NULL
            LIMIT 5000
            """,
            (video_id,),
        )
        pts = cursor.fetchall()

    coords = [(p[0], p[1]) for p in pts]
    heatmap_matrix = generate_heatmap_grid(coords, grid_size=grid_size)
    return {"video_id": video_id, "grid_size": grid_size, "matrix": heatmap_matrix}


# ---------------------------------------------------------------------------
# 7. Multi-Camera Comparison
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/compare")
def compare_cameras(
    project_id: str,
    video_ids: str = Query(..., description="Comma-separated video IDs (2 to 4 videos)"),
):
    """
    Compare multiple video feeds from the same project side-by-side.
    Returns comparative volume, speed profiles, and synchronized timeline measurements.
    """
    v_ids = [v.strip() for v in video_ids.split(",") if v.strip()]
    if len(v_ids) < 2:
        raise HTTPException(status_code=400, detail="Select at least 2 videos to compare.")

    comparison_results = []
    with get_db() as conn:
        cursor = conn.cursor()
        for vid in v_ids[:4]:
            cursor.execute(
                """
                SELECT v.id, v.camera_id, v.name, v.duration_seconds, v.fps,
                       v.analysis_summary_json, c.reprojection_rmse_m
                FROM studio_videos v
                LEFT JOIN studio_calibrations c ON v.id = c.video_id
                WHERE v.id = ? AND v.project_id = ?
                """,
                (vid, project_id),
            )
            v = cursor.fetchone()
            if not v:
                continue

            summary = json.loads(v[5]) if v[5] else {}

            # Fetch measurements timeline
            cursor.execute(
                """
                SELECT interval_start_s, vehicle_count, avg_speed_kmh, occupancy_percent
                FROM studio_measurements
                WHERE video_id = ?
                ORDER BY interval_start_s ASC
                LIMIT 100
                """,
                (vid,),
            )
            m_rows = cursor.fetchall()
            timeline = [
                {
                    "timestamp_s": m[0],
                    "vehicle_count": m[1],
                    "avg_speed_kmh": m[2],
                    "occupancy_percent": m[3],
                }
                for m in m_rows
            ]

            comparison_results.append({
                "video_id": v[0],
                "camera_id": v[1],
                "title": v[2],
                "duration_seconds": v[3],
                "fps": v[4],
                "rmse_m": v[6],
                "summary": summary,
                "timeline": timeline,
            })

    return {"project_id": project_id, "cameras": comparison_results}


# ---------------------------------------------------------------------------
# 8. Exports & Reports Center
# ---------------------------------------------------------------------------

@router.get("/videos/{video_id}/exports")
def list_exports(video_id: str):
    """List all available generated export files for a video."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM studio_exports WHERE video_id = ?", (video_id,))
        rows = cursor.fetchall()

    exports = []
    for r in rows:
        exports.append({
            "id": r["id"],
            "export_type": r["export_type"],
            "filename": r["filename"],
            "file_size_bytes": r["file_size_bytes"],
            "created_at": r["created_at"],
        })
    return {"exports": exports}


@router.get("/exports/{export_id}/download")
def download_export(export_id: str):
    """Download a generated export artifact (CSV, GeoJSON, or JSON)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT filename, file_path FROM studio_exports WHERE id = ?", (export_id,))
        row = cursor.fetchone()
        if not row or not os.path.exists(row[1]):
            raise HTTPException(status_code=404, detail="Export file not found.")

        ext = os.path.splitext(row[0])[1].lower()
        mime = "text/csv" if ext == ".csv" else ("application/geo+json" if ext == ".geojson" else "application/json")

        return FileResponse(
            path=row[1],
            filename=row[0],
            media_type=mime,
        )


# ---------------------------------------------------------------------------
# 9. DataFromSky Architectural Provider & Import
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/videos/{video_id}/import-datafromsky")
async def import_datafromsky_csv(
    project_id: str,
    video_id: str,
    file: UploadFile = File(...),
):
    """
    Ingest external DataFromSky FLOW / TrafficSurvey trajectory CSV.
    Validates, normalizes into internal TrafficOps schema, and computes aggregate metrics.
    """
    content = await file.read()
    try:
        csv_text = content.decode("utf-8")
    except UnicodeDecodeError:
        csv_text = content.decode("latin-1")

    try:
        summary = DataFromSkyAdapter.import_to_project(
            project_id=project_id,
            video_id=video_id,
            csv_content=csv_text,
            source_filename=file.filename or "datafromsky_export.csv",
        )
        return {"summary": summary, "message": "DataFromSky CSV successfully imported and normalized."}
    except Exception as exc:
        logger.error(f"Failed to import DataFromSky data: {exc}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc))
