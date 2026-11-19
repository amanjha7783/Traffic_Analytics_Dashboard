"""
Background Video Processing Worker and Job Orchestration Engine.
Runs High-Throughput Pipelined Video Intelligence (Decoding, Preprocessing,
Inference, Tracking, Homography, Hardware NVENC/OpenCV Video Encoding, and DB Writes).
"""
import os
import time
import json
import uuid
import math
import threading
import logging
import numpy as np
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pathlib import Path

from app.database.database import get_db
from app.video_intelligence.pipelined_engine import PipelinedVideoIntelligenceEngine
from app.video_intelligence.export_service import (
    generate_raw_trajectory_csv,
    generate_geospatial_trajectory_csv,
    generate_trajectories_geojson,
    generate_traffic_stats_csv,
    generate_analysis_summary_json,
)

logger = logging.getLogger(__name__)


class VideoProcessingWorker(threading.Thread):
    def __init__(
        self,
        job_id: str,
        video_id: str,
        project_id: str,
        config: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(name=f"Worker-{job_id}", daemon=True)
        self.job_id = job_id
        self.video_id = video_id
        self.project_id = project_id
        self.config = config or {}

        self.pause_event = threading.Event()
        self.pause_event.set()
        self.stop_event = threading.Event()

        self.current_frame = 0
        self.total_frames = 0
        self.processing_fps = 0.0
        self.progress_percent = 0.0
        self.engine: Optional[PipelinedVideoIntelligenceEngine] = None
        self.telemetry_metrics: Dict[str, Any] = {}

    def pause(self):
        self.pause_event.clear()
        if self.engine:
            self.engine.pause()
        self._update_job_status("PAUSED")

    def resume(self):
        self.pause_event.set()
        if self.engine:
            self.engine.resume()
        self._update_job_status("RUNNING")

    def cancel(self):
        self.stop_event.set()
        self.pause_event.set()
        if self.engine:
            self.engine.cancel()
        self._update_job_status("CANCELLED")

    def _update_job_status(
        self,
        status: str,
        error_msg: Optional[str] = None,
        stage: Optional[str] = None,
        total_frames: Optional[int] = None,
    ):
        now_iso = datetime.now(timezone.utc).isoformat()
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE studio_processing_jobs
                SET status = ?,
                    error_message = COALESCE(?, error_message),
                    progress_percent = ?,
                    current_frame = ?,
                    total_frames = COALESCE(?, total_frames),
                    fps = ?,
                    processing_stage = COALESCE(?, processing_stage),
                    telemetry_metrics_json = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    status,
                    error_msg,
                    self.progress_percent,
                    self.current_frame,
                    total_frames or self.total_frames or None,
                    self.processing_fps,
                    stage,
                    json.dumps(self.telemetry_metrics) if self.telemetry_metrics else None,
                    now_iso,
                    self.job_id,
                ),
            )
            conn.commit()

    def run(self):
        logger.info(f"Starting pipelined processing job {self.job_id} for video {self.video_id}")
        self._update_job_status("RUNNING", stage="QUEUED")

        try:
            # 1. Fetch video and project metadata
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT file_path, fps, width, height, total_frames FROM studio_videos WHERE id = ?",
                    (self.video_id,),
                )
                video_row = cursor.fetchone()
                if not video_row:
                    raise FileNotFoundError(f"Video {self.video_id} not found in database.")

                video_path = video_row[0]
                video_fps = video_row[1] or 30.0
                video_w = video_row[2] or 1920
                video_h = video_row[3] or 1080
                video_frames = video_row[4] or 0

                cursor.execute(
                    "SELECT latitude, longitude FROM studio_projects WHERE id = ?",
                    (self.project_id,),
                )
                proj_row = cursor.fetchone()
                project_coords = (proj_row[0], proj_row[1]) if proj_row and proj_row[0] else None

                cursor.execute(
                    "SELECT homography_matrix_json, quality_status FROM studio_calibrations WHERE video_id = ?",
                    (self.video_id,),
                )
                calib_row = cursor.fetchone()
                homography_matrix = None
                if calib_row and calib_row[0]:
                    try:
                        homography_matrix = json.loads(calib_row[0])
                    except Exception as e:
                        logger.warning(f"Failed to parse homography matrix: {e}")

                cursor.execute(
                    "SELECT id, name, region_type, vertices_pixel_json, area_m2 FROM studio_regions WHERE video_id = ?",
                    (self.video_id,),
                )
                region_rows = cursor.fetchall()
                regions = []
                for r in region_rows:
                    try:
                        v_px = json.loads(r[3]) if r[3] else []
                        regions.append({
                            "id": r[0],
                            "name": r[1],
                            "type": r[2],
                            "vertices_pixel": v_px,
                            "area_sqm": r[4],
                        })
                    except Exception:
                        pass

            if not os.path.exists(video_path):
                raise FileNotFoundError(f"Video source file not found on disk: {video_path}")

            video_dir = Path(video_path).parent
            gen_annotated = self.config.get("generate_annotated_video", True)
            annotated_video_path = str(video_dir / f"annotated_{self.video_id}.mp4") if gen_annotated else None

            # Calculate total frames for progress calculation
            self.total_frames = video_frames or 100
            max_frames = self.config.get("max_frames")
            if max_frames and max_frames > 0:
                self.total_frames = min(self.total_frames, max_frames)

            self._update_job_status("RUNNING", stage="INITIALIZING", total_frames=self.total_frames)

            # Progress sync callback
            def on_progress(frame_idx: int, metrics: Dict[str, Any]):
                self.current_frame = frame_idx
                self.processing_fps = metrics.get("tracking_fps") or metrics.get("inference_fps") or 0.0
                self.progress_percent = round(min(99.0, (frame_idx / max(1, self.total_frames)) * 100), 1)
                self.telemetry_metrics = metrics
                self._update_job_status("RUNNING", stage="PROCESSING", total_frames=self.total_frames)

            # 2. Instantiate and execute Pipelined Video Intelligence Engine
            self.engine = PipelinedVideoIntelligenceEngine(
                job_id=self.job_id,
                video_id=self.video_id,
                project_id=self.project_id,
                video_path=video_path,
                annotated_output_path=annotated_video_path,
                config=self.config,
                homography_matrix=homography_matrix,
                project_coords=project_coords,
                measurement_regions=regions,
                progress_callback=on_progress,
            )

            result = self.engine.execute()
            if self.stop_event.is_set() or not result.get("success", False):
                logger.info(f"Job {self.job_id} cancelled or aborted.")
                self._update_job_status("CANCELLED", stage="CANCELLED")
                return

            all_observations = result.get("all_observations", [])
            self.telemetry_metrics = result.get("metrics", {})

            # 3. Aggregate Vehicle Track Summaries
            track_aggregates: Dict[int, Dict[str, Any]] = {}
            for obs in all_observations:
                t_id = obs["track_id"]
                if t_id not in track_aggregates:
                    track_aggregates[t_id] = {
                        "track_id": t_id,
                        "vehicle_class": obs["vehicle_class"],
                        "first_s": obs["timestamp_s"],
                        "last_s": obs["timestamp_s"],
                        "frames": 0,
                        "speeds": [],
                    }
                item = track_aggregates[t_id]
                item["frames"] += 1
                item["last_s"] = max(item["last_s"], obs["timestamp_s"])
                if obs.get("speed_kmh"):
                    item["speeds"].append(obs["speed_kmh"])

            # 4. Batch Insert Vehicle Tracks
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM studio_vehicle_tracks WHERE video_id = ?", (self.video_id,))
                tracks_batch = []
                for t_id, meta in track_aggregates.items():
                    s_list = meta["speeds"]
                    avg_s = round(sum(s_list) / len(s_list), 1) if s_list else None
                    max_s = round(max(s_list), 1) if s_list else None
                    dur = round(meta["last_s"] - meta["first_s"], 2)
                    tracks_batch.append((
                        f"trk-{self.video_id[:8]}-{t_id}",
                        self.job_id,
                        self.video_id,
                        self.project_id,
                        t_id,
                        meta["vehicle_class"],
                        meta["first_s"],
                        meta["last_s"],
                        dur,
                        avg_s,
                        max_s,
                    ))

                if tracks_batch:
                    cursor.executemany(
                        """
                        INSERT INTO studio_vehicle_tracks (
                            id, job_id, video_id, project_id, track_id, vehicle_class,
                            first_timestamp_s, last_timestamp_s, duration_s,
                            avg_speed_kmh, max_speed_kmh
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        tracks_batch,
                    )
                conn.commit()

            # 4b. Generate Time-Series Traffic Measurements (studio_measurements)
            if all_observations:
                max_ts = max(obs["timestamp_s"] for obs in all_observations)
                step_size = 1.0 if max_ts >= 10.0 else 0.5
                num_bins = max(1, int(math.ceil(max_ts / step_size)))

                meas_batch = []
                for b in range(num_bins):
                    t_start = round(b * step_size, 2)
                    t_end = round((b + 1) * step_size, 2)
                    bin_obs = [o for o in all_observations if t_start <= o["timestamp_s"] < t_end]
                    if not bin_obs:
                        continue

                    uniq_tracks = set(o["track_id"] for o in bin_obs)
                    v_count = len(uniq_tracks)
                    v_speeds = [o["speed_kmh"] for o in bin_obs if o.get("speed_kmh") is not None]
                    avg_v_spd = round(sum(v_speeds) / len(v_speeds), 1) if v_speeds else 0.0
                    max_v_spd = round(max(v_speeds), 1) if v_speeds else 0.0
                    median_v_spd = round(float(np.median(v_speeds)), 1) if v_speeds else 0.0

                    road_area = sum(r.get("area_sqm") or 1000.0 for r in regions) or 1000.0
                    dens_m2 = round(v_count / road_area, 5)
                    dens_km2 = round(dens_m2 * 1e6, 2)
                    occ_pct = min(100.0, round((v_count * 15.0 / road_area) * 100.0, 1))
                    flow_vph = round(v_count * (3600.0 / step_size), 1)

                    los = "LOS A" if avg_v_spd >= 60 else ("LOS B" if avg_v_spd >= 45 else ("LOS C" if avg_v_spd >= 30 else "LOS D"))
                    cls_map = {}
                    for o in bin_obs:
                        cls_map[o["vehicle_class"]] = cls_map.get(o["vehicle_class"], 0) + 1

                    m_id = f"meas-{self.video_id[:8]}-{b:04d}"
                    meas_batch.append((
                        m_id,
                        self.job_id,
                        self.video_id,
                        self.project_id,
                        regions[0]["id"] if regions else None,
                        t_start,
                        t_end,
                        v_count,
                        v_count,
                        dens_m2,
                        dens_km2,
                        occ_pct,
                        avg_v_spd,
                        median_v_spd,
                        max_v_spd,
                        flow_vph,
                        los,
                        json.dumps(cls_map),
                    ))

                if meas_batch:
                    with get_db() as conn:
                        cursor = conn.cursor()
                        cursor.execute("DELETE FROM studio_measurements WHERE video_id = ?", (self.video_id,))
                        cursor.executemany(
                            """
                            INSERT INTO studio_measurements (
                                id, job_id, video_id, project_id, region_id,
                                interval_start_s, interval_end_s, vehicle_count, unique_vehicle_count,
                                density_per_m2, density_per_km2, occupancy_percent,
                                avg_speed_kmh, median_speed_kmh, max_speed_kmh,
                                flow_rate_vph, congestion_level, class_breakdown_json
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            meas_batch,
                        )
                        conn.commit()

            # 5. Generate Export Artifacts (CSV, GeoJSON, Summary JSON)
            export_dir = video_dir / "exports"
            export_dir.mkdir(parents=True, exist_ok=True)

            raw_csv = generate_raw_trajectory_csv(all_observations, export_dir / "raw_trajectories.csv")
            geo_csv = generate_geospatial_trajectory_csv(all_observations, export_dir / "geospatial_trajectories.csv")
            geojson_path = generate_trajectories_geojson(all_observations, export_dir / "trajectories.geojson")

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT interval_start_s, vehicle_count, density_per_km2,
                           occupancy_percent, avg_speed_kmh, congestion_level
                    FROM studio_measurements
                    WHERE video_id = ?
                    ORDER BY interval_start_s ASC
                    """,
                    (self.video_id,),
                )
                m_rows = cursor.fetchall()
                meas_dicts = [
                    {
                        "timestamp_s": r[0],
                        "vehicle_count": r[1],
                        "density_veh_sqkm": r[2],
                        "road_occupancy_percent": r[3],
                        "avg_speed_kmh": r[4],
                        "level_of_service": r[5],
                    }
                    for r in m_rows
                ]
            stats_csv = generate_traffic_stats_csv(meas_dicts, export_dir / "traffic_statistics.csv")

            class_dist: Dict[str, int] = {}
            for t in track_aggregates.values():
                cls_name = t["vehicle_class"]
                class_dist[cls_name] = class_dist.get(cls_name, 0) + 1

            all_speeds = [o["speed_kmh"] for o in all_observations if o.get("speed_kmh")]
            global_avg_speed = round(sum(all_speeds) / len(all_speeds), 1) if all_speeds else 0.0

            summary_data = {
                "project_id": self.project_id,
                "video_id": self.video_id,
                "total_vehicles_detected": len(track_aggregates),
                "total_trajectory_points": len(all_observations),
                "vehicle_class_distribution": class_dist,
                "avg_speed_kmh": global_avg_speed,
                "max_speed_kmh": max(all_speeds) if all_speeds else 0.0,
                "processed_frames": self.current_frame,
                "video_fps": video_fps,
                "calibrated": homography_matrix is not None,
                "annotated_video_available": bool(annotated_video_path and os.path.exists(annotated_video_path)),
                "telemetry_metrics": self.telemetry_metrics,
            }
            summary_json_path = generate_analysis_summary_json(summary_data, export_dir / "summary_report.json")

            now_iso = datetime.now(timezone.utc).isoformat()
            with get_db() as conn:
                cursor = conn.cursor()
                exports = [
                    ("TRAJECTORY_CSV", "raw_trajectories.csv", raw_csv),
                    ("GEOSPATIAL_CSV", "geospatial_trajectories.csv", geo_csv),
                    ("GEOJSON", "trajectories.geojson", geojson_path),
                    ("TRAFFIC_STATS_CSV", "traffic_statistics.csv", stats_csv),
                    ("SUMMARY_JSON", "summary_report.json", summary_json_path),
                ]
                for exp_type, filename, fpath in exports:
                    fsize = os.path.getsize(fpath) if os.path.exists(fpath) else 0
                    cursor.execute(
                        """
                        INSERT OR REPLACE INTO studio_exports (
                            id, video_id, project_id, job_id, export_type,
                            filename, file_path, file_size_bytes, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            f"exp-{self.video_id[:8]}-{exp_type}",
                            self.video_id,
                            self.project_id,
                            self.job_id,
                            exp_type,
                            filename,
                            fpath,
                            fsize,
                            now_iso,
                        ),
                    )

                cursor.execute(
                    """
                    UPDATE studio_videos
                    SET status = 'analyzed',
                        annotated_video_path = COALESCE(?, annotated_video_path),
                        analysis_summary_json = ?
                    WHERE id = ?
                    """,
                    (annotated_video_path, json.dumps(summary_data), self.video_id),
                )
                conn.commit()

            # 6. Mark Job Completed
            self.progress_percent = 100.0
            self.current_frame = self.total_frames
            self.processing_fps = self.telemetry_metrics.get("end_to_end_fps") or self.processing_fps
            self._update_job_status("COMPLETED", stage="COMPLETED", total_frames=self.total_frames)
            logger.info(f"Job {self.job_id} successfully COMPLETED at {self.processing_fps} FPS!")

        except Exception as e:
            logger.error(f"Processing job {self.job_id} failed: {e}", exc_info=True)
            self._update_job_status("FAILED", error_msg=str(e), stage="FAILED")
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE studio_videos SET status = 'FAILED' WHERE id = ?", (self.video_id,))
                conn.commit()


class JobManager:
    """Manages active and historical video processing workers."""
    def __init__(self):
        self.workers: Dict[str, VideoProcessingWorker] = {}
        self.lock = threading.Lock()

    def start_job(
        self,
        video_id: str,
        project_id: str,
        config: Optional[Dict[str, Any]] = None,
    ) -> str:
        job_id = f"job-{uuid.uuid4().hex[:8]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT total_frames, fps, duration_seconds FROM studio_videos WHERE id = ?", (video_id,))
            v_row = cursor.fetchone()
            video_total_frames = 0
            if v_row:
                video_total_frames = v_row[0] or (int((v_row[1] or 30.0) * (v_row[2] or 0))) or 0

            max_frames = (config or {}).get("max_frames")
            if max_frames and max_frames > 0:
                init_frames = min(video_total_frames or max_frames, max_frames)
            else:
                init_frames = video_total_frames

            cursor.execute(
                """
                INSERT INTO studio_processing_jobs (
                    id, video_id, project_id, status, progress_percent,
                    current_frame, total_frames, fps, processing_stage,
                    config_json, created_at, updated_at
                ) VALUES (?, ?, ?, 'PENDING', 0.0, 0, ?, 0.0, 'QUEUED', ?, ?, ?)
                """,
                (job_id, video_id, project_id, init_frames, json.dumps(config or {}), now_iso, now_iso),
            )
            cursor.execute("UPDATE studio_videos SET status = 'PROCESSING' WHERE id = ?", (video_id,))
            conn.commit()

        worker = VideoProcessingWorker(
            job_id=job_id,
            video_id=video_id,
            project_id=project_id,
            config=config,
        )

        with self.lock:
            self.workers[job_id] = worker
            worker.start()

        return job_id

    def pause_job(self, job_id: str) -> bool:
        with self.lock:
            worker = self.workers.get(job_id)
            if worker and worker.is_alive():
                worker.pause()
                return True
        return False

    def resume_job(self, job_id: str) -> bool:
        with self.lock:
            worker = self.workers.get(job_id)
            if worker and worker.is_alive():
                worker.resume()
                return True
        return False

    def cancel_job(self, job_id: str) -> bool:
        with self.lock:
            worker = self.workers.get(job_id)
            if worker and worker.is_alive():
                worker.cancel()
                return True
        return False

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM studio_processing_jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            if not row:
                return None

            telemetry = None
            if "telemetry_metrics_json" in row.keys() and row["telemetry_metrics_json"]:
                try:
                    telemetry = json.loads(row["telemetry_metrics_json"])
                except Exception:
                    pass

            return {
                "id": row["id"],
                "video_id": row["video_id"],
                "project_id": row["project_id"],
                "status": row["status"],
                "progress_percent": row["progress_percent"],
                "current_frame": row["current_frame"],
                "total_frames": row["total_frames"],
                "processing_fps": row["fps"],
                "processing_stage": row["processing_stage"] if "processing_stage" in row.keys() else "PROCESSING",
                "error_message": row["error_message"],
                "telemetry_metrics": telemetry,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }


job_manager = JobManager()
