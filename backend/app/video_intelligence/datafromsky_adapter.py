"""
DataFromSky Adapter and Telemetry Ingestion Provider.
Parses, validates, and normalizes trajectory and traffic survey data
from DataFromSky FLOW, Aerial, and TrafficSurvey exports into TrafficOps schema.
"""
import csv
import io
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pathlib import Path

from app.database.database import get_db

logger = logging.getLogger(__name__)

# Taxonomy mapping: DataFromSky class names -> TrafficOps standard vehicle classes
DATAFROMSKY_CLASS_MAP = {
    "car": "FOUR-WHEELER",
    "automobile": "FOUR-WHEELER",
    "sedan": "FOUR-WHEELER",
    "suv": "FOUR-WHEELER",
    "light vehicle": "FOUR-WHEELER",
    "motorcycle": "TWO-WHEELER",
    "motorbike": "TWO-WHEELER",
    "moped": "TWO-WHEELER",
    "scooter": "TWO-WHEELER",
    "heavy vehicle": "TRUCK",
    "truck": "TRUCK",
    "lorry": "TRUCK",
    "trailer": "TRUCK",
    "van": "FOUR-WHEELER",
    "bus": "BUS",
    "coach": "BUS",
    "rickshaw": "THREE-WHEELER",
    "auto": "THREE-WHEELER",
    "auto_rickshaw": "THREE-WHEELER",
    "three_wheeler": "THREE-WHEELER",
    "bicycle": "BICYCLE",
    "cyclist": "BICYCLE",
    "pedestrian": "PEDESTRIAN",
}


def normalize_class(raw_class: str) -> str:
    cleaned = (raw_class or "").strip().lower().replace("-", " ")
    return DATAFROMSKY_CLASS_MAP.get(cleaned, "OTHER")


class DataFromSkyAdapter:
    """
    Ingests DataFromSky trajectory CSV and stores normalized records
    in TrafficOps Studio database.
    """

    @classmethod
    def parse_csv(
        cls,
        csv_content: str,
        delimiter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        sample = csv_content[:4096]
        if delimiter is None:
            if ";" in sample and "," not in sample:
                delimiter = ";"
            elif "\t" in sample and "," not in sample:
                delimiter = "\t"
            else:
                delimiter = ","

        reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)
        raw_rows = list(reader)
        if not raw_rows:
            return []

        normalized_records = []
        for row in raw_rows:
            clean_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}

            track_id_val = (
                clean_row.get("track_id")
                or clean_row.get("vehicle_id")
                or clean_row.get("id")
                or clean_row.get("object_id")
            )
            frame_val = (
                clean_row.get("frame_idx")
                or clean_row.get("frame_id")
                or clean_row.get("frame")
                or clean_row.get("time_frame")
            )
            time_val = (
                clean_row.get("timestamp_s")
                or clean_row.get("timestamp")
                or clean_row.get("time")
                or clean_row.get("time_s")
            )
            class_val = (
                clean_row.get("vehicle_class")
                or clean_row.get("class")
                or clean_row.get("category")
                or clean_row.get("type")
                or "car"
            )
            speed_val = (
                clean_row.get("speed_kmh")
                or clean_row.get("speed")
                or clean_row.get("velocity_kmh")
                or clean_row.get("velocity")
            )
            x_m_val = (
                clean_row.get("ground_x_m")
                or clean_row.get("x_m")
                or clean_row.get("x")
                or clean_row.get("ground_x")
            )
            y_m_val = (
                clean_row.get("ground_y_m")
                or clean_row.get("y_m")
                or clean_row.get("y")
                or clean_row.get("ground_y")
            )
            lat_val = clean_row.get("latitude") or clean_row.get("lat")
            lon_val = (
                clean_row.get("longitude")
                or clean_row.get("lon")
                or clean_row.get("lng")
            )
            img_x_val = (
                clean_row.get("image_x")
                or clean_row.get("centroid_x")
                or clean_row.get("x_px")
                or clean_row.get("u")
            )
            img_y_val = (
                clean_row.get("image_y")
                or clean_row.get("centroid_y")
                or clean_row.get("y_px")
                or clean_row.get("v")
            )

            try:
                rec = {
                    "track_id": int(float(track_id_val)) if track_id_val is not None else 0,
                    "frame_idx": int(float(frame_val)) if frame_val is not None else 0,
                    "timestamp_s": round(float(time_val), 3) if time_val is not None else 0.0,
                    "vehicle_class": normalize_class(class_val),
                    "speed_kmh": round(float(speed_val), 2) if speed_val is not None and speed_val != "" else None,
                    "ground_x_m": round(float(x_m_val), 3) if x_m_val is not None and x_m_val != "" else None,
                    "ground_y_m": round(float(y_m_val), 3) if y_m_val is not None and y_m_val != "" else None,
                    "latitude": round(float(lat_val), 7) if lat_val is not None and lat_val != "" else None,
                    "longitude": round(float(lon_val), 7) if lon_val is not None and lon_val != "" else None,
                    "image_x": round(float(img_x_val), 1) if img_x_val is not None and img_x_val != "" else 0.0,
                    "image_y": round(float(img_y_val), 1) if img_y_val is not None and img_y_val != "" else 0.0,
                }
                normalized_records.append(rec)
            except (ValueError, TypeError) as parse_err:
                logger.debug(f"Skipping malformed DataFromSky row: {parse_err}")
                continue

        return normalized_records

    @classmethod
    def import_to_project(
        cls,
        project_id: str,
        video_id: str,
        csv_content: str,
        source_filename: str
    ) -> Dict[str, Any]:
        records = cls.parse_csv(csv_content)
        if not records:
            raise ValueError("No valid trajectory records found in CSV file.")

        import_id = f"dfs-{video_id[:8]}-{len(records)}"
        virtual_job_id = f"job-dfs-{video_id[:8]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        track_map: Dict[int, Dict[str, Any]] = {}
        class_counts: Dict[str, int] = {}
        all_speeds: List[float] = []

        for r in records:
            t_id = r["track_id"]
            v_cls = r["vehicle_class"]
            spd = r["speed_kmh"]

            if spd is not None and spd > 0:
                all_speeds.append(spd)

            if t_id not in track_map:
                track_map[t_id] = {
                    "vehicle_class": v_cls,
                    "first_seen": r["timestamp_s"],
                    "last_seen": r["timestamp_s"],
                    "frames": 0,
                    "speeds": [],
                }
                class_counts[v_cls] = class_counts.get(v_cls, 0) + 1

            meta = track_map[t_id]
            meta["frames"] += 1
            meta["last_seen"] = max(meta["last_seen"], r["timestamp_s"])
            if spd is not None:
                meta["speeds"].append(spd)

        avg_spd = round(sum(all_speeds) / len(all_speeds), 1) if all_speeds else 0.0
        max_spd = round(max(all_speeds), 1) if all_speeds else 0.0

        summary = {
            "total_records": len(records),
            "unique_vehicles": len(track_map),
            "class_distribution": class_counts,
            "avg_speed_kmh": avg_spd,
            "max_speed_kmh": max_spd,
            "filename": source_filename,
        }

        with get_db() as conn:
            cursor = conn.cursor()

            # Record import audit log
            cursor.execute(
                """
                INSERT OR REPLACE INTO studio_datafromsky_imports (
                    id, project_id, video_id, filename, provider_source,
                    imported_tracks_count, imported_observations_count,
                    metadata_json, created_at
                ) VALUES (?, ?, ?, ?, 'DataFromSky FLOW', ?, ?, ?, ?)
                """,
                (
                    import_id,
                    project_id,
                    video_id,
                    source_filename,
                    len(track_map),
                    len(records),
                    json.dumps(summary),
                    now_iso,
                )
            )

            # Insert vehicle tracks
            for t_id, meta in track_map.items():
                v_speeds = meta["speeds"]
                t_avg_spd = round(sum(v_speeds) / len(v_speeds), 1) if v_speeds else None
                t_max_spd = round(max(v_speeds), 1) if v_speeds else None
                dur = round(meta["last_seen"] - meta["first_seen"], 2)

                cursor.execute(
                    """
                    INSERT OR REPLACE INTO studio_vehicle_tracks (
                        id, job_id, video_id, project_id, track_id, vehicle_class,
                        first_timestamp_s, last_timestamp_s, duration_s,
                        avg_speed_kmh, max_speed_kmh
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"trk-{video_id[:8]}-{t_id}",
                        virtual_job_id,
                        video_id,
                        project_id,
                        t_id,
                        meta["vehicle_class"],
                        meta["first_seen"],
                        meta["last_seen"],
                        dur,
                        t_avg_spd,
                        t_max_spd,
                    )
                )

            # Insert trajectory observations
            chunk_size = 500
            for i in range(0, len(records), chunk_size):
                chunk = records[i:i + chunk_size]
                cursor.executemany(
                    """
                    INSERT INTO studio_trajectories (
                        job_id, video_id, project_id, track_id, frame_idx, timestamp_s,
                        vehicle_class, confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2,
                        image_x, image_y, ground_x_m, ground_y_m, latitude, longitude,
                        speed_kmh, direction
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            virtual_job_id,
                            video_id,
                            project_id,
                            r["track_id"],
                            r["frame_idx"],
                            r["timestamp_s"],
                            r["vehicle_class"],
                            1.0,
                            0.0, 0.0, 0.0, 0.0,
                            r["image_x"],
                            r["image_y"],
                            r["ground_x_m"],
                            r["ground_y_m"],
                            r["latitude"],
                            r["longitude"],
                            r["speed_kmh"],
                            "Forward",
                        )
                        for r in chunk
                    ]
                )

            # Update video record
            cursor.execute(
                """
                UPDATE studio_videos
                SET status = 'analyzed',
                    analysis_summary_json = ?
                WHERE id = ?
                """,
                (json.dumps(summary), video_id)
            )
            conn.commit()

        logger.info(f"Imported DataFromSky data: {len(records)} points, {len(track_map)} vehicles for {video_id}.")
        return summary
