import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Sequence

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.database.database import get_db_connection
from app.geospatial.camera_calibration import compute_homography
from app.services.routing import get_route
from app.vision.camera_manager import camera_manager

router = APIRouter()


class CorridorConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Optional[str] = Field(default=None, min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    camera_a_id: str
    camera_b_id: str
    road_name: Optional[str] = Field(default=None, max_length=160)
    road_width_m: Optional[float] = Field(default=None, gt=0, le=200)
    num_lanes: Optional[int] = Field(default=None, ge=1, le=30)
    speed_limit_kmh: Optional[float] = Field(default=None, gt=0, le=250)
    direction: Optional[str] = Field(default=None, max_length=80)


class CorridorUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    road_width_m: Optional[float] = Field(default=None, gt=0, le=200)
    num_lanes: Optional[int] = Field(default=None, ge=1, le=30)
    speed_limit_kmh: Optional[float] = Field(default=None, gt=0, le=250)
    direction: Optional[str] = Field(default=None, max_length=80)


class CalibrationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    camera_id: str
    image_points: list[list[float]]
    ground_points_m: list[list[float]]


def _measure_road(camera_a_id: str, camera_b_id: str) -> dict:
    camera_a = camera_manager.get_camera(camera_a_id)
    camera_b = camera_manager.get_camera(camera_b_id)
    if not camera_a or not camera_b:
        raise HTTPException(status_code=404, detail="Both corridor cameras must be configured")
    coords = (
        camera_a.get("longitude"), camera_a.get("latitude"),
        camera_b.get("longitude"), camera_b.get("latitude"),
    )
    if any(value is None for value in coords):
        raise HTTPException(status_code=422, detail="Set GPS coordinates for both cameras before measuring the road")
    result = get_route(*coords, alternatives=False)
    routes = result.get("routes", []) if result else []
    if not routes or not routes[0].get("geometry_coordinates"):
        raise HTTPException(
            status_code=502,
            detail="OSRM did not return road geometry; no straight-line or estimated road length was substituted",
        )
    route = routes[0]
    return {
        "road_length_m": route["distance_km"] * 1000,
        "geometry_geojson": json.dumps({
            "type": "LineString",
            "coordinates": route["geometry_coordinates"],
        }),
        "road_name": route.get("summary") or "OSM road route",
    }


@router.get("")
def list_corridors():
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM traffic_corridors ORDER BY name"
        ).fetchall()
    return {"corridors": [dict(row) for row in rows]}


@router.post("")
def create_corridor(config: CorridorConfig):
    measured = _measure_road(config.camera_a_id, config.camera_b_id)
    corridor_id = config.id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        try:
            conn.execute(
                """
                INSERT INTO traffic_corridors (
                    id, name, camera_a_id, camera_b_id, road_name, road_length_m,
                    road_width_m, num_lanes, speed_limit_kmh, direction,
                    geometry_geojson, created_at, data_source, is_demo_data,
                    road_width_source, lane_count_source
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OSRM / OpenStreetMap',
                          0, ?, ?)
                """,
                (
                    corridor_id, config.name, config.camera_a_id, config.camera_b_id,
                    config.road_name or measured["road_name"], measured["road_length_m"],
                    config.road_width_m, config.num_lanes, config.speed_limit_kmh,
                    config.direction, measured["geometry_geojson"], now,
                    "MANUAL" if config.road_width_m is not None else None,
                    "MANUAL" if config.num_lanes is not None else None,
                ),
            )
        except Exception as exc:
            if "UNIQUE constraint failed" in str(exc):
                raise HTTPException(status_code=409, detail="Corridor ID already exists") from exc
            raise
    return get_corridor(corridor_id)


@router.get("/{corridor_id}")
def get_corridor(corridor_id: str):
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM traffic_corridors WHERE id = ?", (corridor_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Corridor not found")
    result = dict(row)
    result["geometry"] = json.loads(result["geometry_geojson"]) if result.get("geometry_geojson") else None
    result.pop("geometry_geojson", None)
    result["calibrations"] = get_calibrations(corridor_id)
    return result


@router.put("/{corridor_id}")
def update_corridor(corridor_id: str, updates: CorridorUpdate):
    values = updates.model_dump(exclude_unset=True)
    if not values:
        return get_corridor(corridor_id)
    with get_db_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM traffic_corridors WHERE id = ?", (corridor_id,)
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Corridor not found")
        if "road_width_m" in values:
            values["road_width_source"] = "MANUAL" if values["road_width_m"] is not None else None
        if "num_lanes" in values:
            values["lane_count_source"] = "MANUAL" if values["num_lanes"] is not None else None
        assignments = ", ".join(f"{key} = ?" for key in values)
        conn.execute(
            f"UPDATE traffic_corridors SET {assignments}, is_demo_data = 0 WHERE id = ?",
            (*values.values(), corridor_id),
        )
    return get_corridor(corridor_id)


@router.post("/{corridor_id}/measure")
def remeasure_corridor(corridor_id: str):
    with get_db_connection() as conn:
        corridor = conn.execute(
            "SELECT camera_a_id, camera_b_id FROM traffic_corridors WHERE id = ?",
            (corridor_id,),
        ).fetchone()
    if corridor is None:
        raise HTTPException(status_code=404, detail="Corridor not found")
    measured = _measure_road(corridor["camera_a_id"], corridor["camera_b_id"])
    with get_db_connection() as conn:
        conn.execute(
            """
            UPDATE traffic_corridors
            SET road_length_m = ?, geometry_geojson = ?, road_name = ?,
                data_source = 'OSRM / OpenStreetMap', is_demo_data = 0
            WHERE id = ?
            """,
            (
                measured["road_length_m"], measured["geometry_geojson"],
                measured["road_name"], corridor_id,
            ),
        )
    return get_corridor(corridor_id)


@router.post("/{corridor_id}/calibration")
def set_camera_calibration(corridor_id: str, request: CalibrationRequest):
    corridor = get_corridor(corridor_id)
    if request.camera_id not in (corridor["camera_a_id"], corridor["camera_b_id"]):
        raise HTTPException(status_code=422, detail="Camera must belong to this corridor")
    try:
        matrix, rmse = compute_homography(request.image_points, request.ground_points_m)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    calibration_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO camera_calibrations (
                id, camera_id, homography_matrix_json, ground_control_points_json,
                is_calibrated, calibrated_at, reprojection_rmse_m, calibration_source
            ) VALUES (?, ?, ?, ?, 1, ?, ?, 'GROUND_CONTROL_POINTS')
            """,
            (
                calibration_id, request.camera_id, json.dumps(matrix),
                json.dumps({
                    "image_points": request.image_points,
                    "ground_points_m": request.ground_points_m,
                }),
                now, rmse,
            ),
        )
    return {
        "calibration_id": calibration_id,
        "camera_id": request.camera_id,
        "is_calibrated": True,
        "reprojection_rmse_m": rmse,
        "homography": matrix,
        "calibrated_at": now,
    }


def get_calibrations(corridor_id: str) -> list[dict]:
    with get_db_connection() as conn:
        cameras = conn.execute(
            "SELECT camera_a_id, camera_b_id FROM traffic_corridors WHERE id = ?",
            (corridor_id,),
        ).fetchone()
        if cameras is None:
            return []
        rows = conn.execute(
            """
            SELECT camera_id, is_calibrated, calibrated_at,
                   reprojection_rmse_m, calibration_source,
                   homography_matrix_json, ground_control_points_json
            FROM camera_calibrations
            WHERE camera_id IN (?, ?)
            ORDER BY calibrated_at DESC
            """,
            (cameras["camera_a_id"], cameras["camera_b_id"]),
        ).fetchall()
    latest = {}
    for row in rows:
        if row["camera_id"] in latest:
            continue
        calibration = dict(row)
        calibration["homography_matrix"] = json.loads(
            calibration.pop("homography_matrix_json")
        ) if calibration.get("homography_matrix_json") else None
        calibration["ground_control_points"] = json.loads(
            calibration.pop("ground_control_points_json")
        ) if calibration.get("ground_control_points_json") else None
        latest[row["camera_id"]] = calibration
    return list(latest.values())
