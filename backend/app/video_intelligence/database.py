"""
Database Schema and Table Definitions for Video Intelligence Studio.
Manages isolated project workspaces, multi-camera video sources, ground-control calibrations,
measurement regions, background processing jobs, trajectories, traffic density, and exports.
"""
import os
import sqlite3
import logging
from typing import Generator
from contextlib import contextmanager
from app.config import DATABASE_PATH

logger = logging.getLogger(__name__)

DB_PATH = str(DATABASE_PATH)


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Provide a transactional connection with row_factory enabled."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Studio Database transaction error: {e}")
        raise
    finally:
        conn.close()


def init_studio_db():
    """Create all normalized tables and indexes required by Video Intelligence Studio."""
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Video Intelligence Projects Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS studio_projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            location TEXT,
            city TEXT NOT NULL,
            state TEXT,
            country TEXT DEFAULT 'India',
            road_name TEXT,
            latitude REAL,
            longitude REAL,
            crs TEXT DEFAULT 'EPSG:32644 (WGS 84 / UTM Zone 44N)',
            status TEXT DEFAULT 'ACTIVE',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """)

        # 2. Video Sources (Cameras / CCTV Feeds per Project)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS studio_videos (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            camera_id TEXT NOT NULL,
            name TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size_bytes INTEGER NOT NULL,
            duration_seconds REAL,
            width INTEGER,
            height INTEGER,
            fps REAL DEFAULT 30.0,
            total_frames INTEGER,
            codec TEXT,
            has_audio INTEGER DEFAULT 0,
            thumbnail_path TEXT,
            first_frame_path TEXT,
            annotated_video_path TEXT,
            analysis_summary_json TEXT,
            status TEXT DEFAULT 'UPLOADED',
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES studio_projects(id) ON DELETE CASCADE
        )
        """)

        # Safe column check for existing databases
        for col, col_type in [("annotated_video_path", "TEXT"), ("analysis_summary_json", "TEXT")]:
            try:
                cursor.execute(f"ALTER TABLE studio_videos ADD COLUMN {col} {col_type}")
            except sqlite3.OperationalError:
                pass

        # 3. Camera Calibrations (Ground-Plane Homography)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS studio_calibrations (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL UNIQUE,
            project_id TEXT NOT NULL,
            homography_matrix_json TEXT,
            reprojection_rmse_m REAL,
            inlier_count INTEGER DEFAULT 0,
            quality_status TEXT DEFAULT 'UNCOMMITTED',
            crs TEXT DEFAULT 'EPSG:32644',
            ground_control_points_json TEXT,
            source_width INTEGER,
            source_height INTEGER,
            calibrated_at TEXT,
            FOREIGN KEY (video_id) REFERENCES studio_videos(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES studio_projects(id) ON DELETE CASCADE
        )
        """)

        # 4. Measurement Regions (Polygons & Gates for Area / Density / Flow)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS studio_regions (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            region_type TEXT NOT NULL, -- ROAD_SURFACE, LANE, INTERSECTION, MONITORING_ZONE, VIRTUAL_GATE, CONGESTION_ZONE, CUSTOM
            vertices_pixel_json TEXT NOT NULL, -- [[x1,y1], [x2,y2], ...]
            vertices_ground_json TEXT,         -- [[X1,Y1], [X2,Y2], ...] in meters
            area_m2 REAL,
            perimeter_m REAL,
            road_width_m REAL,
            color_hex TEXT DEFAULT '#315B8A',
            created_at TEXT NOT NULL,
            FOREIGN KEY (video_id) REFERENCES studio_videos(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES studio_projects(id) ON DELETE CASCADE
        )
        """)

        # 5. Background Processing Jobs
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS studio_processing_jobs (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            status TEXT DEFAULT 'PENDING', -- PENDING, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED
            progress_percent REAL DEFAULT 0.0,
            current_frame INTEGER DEFAULT 0,
            total_frames INTEGER DEFAULT 0,
            fps REAL DEFAULT 0.0,
            processing_stage TEXT DEFAULT 'QUEUED',
            error_message TEXT,
            config_json TEXT,
            telemetry_metrics_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (video_id) REFERENCES studio_videos(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES studio_projects(id) ON DELETE CASCADE
        )
        """)

        # 6. Trajectory Observations (Frame-by-frame persistent detections)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS studio_trajectories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT NOT NULL,
            video_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            track_id INTEGER NOT NULL,
            frame_idx INTEGER NOT NULL,
            timestamp_s REAL NOT NULL,
            vehicle_class TEXT NOT NULL,
            confidence REAL NOT NULL,
            bbox_x1 REAL NOT NULL,
            bbox_y1 REAL NOT NULL,
            bbox_x2 REAL NOT NULL,
            bbox_y2 REAL NOT NULL,
            image_x REAL NOT NULL,
            image_y REAL NOT NULL,
            ground_x_m REAL,
            ground_y_m REAL,
            latitude REAL,
            longitude REAL,
            speed_kmh REAL,
            acceleration_ms2 REAL,
            direction TEXT,
            FOREIGN KEY (job_id) REFERENCES studio_processing_jobs(id) ON DELETE CASCADE,
            FOREIGN KEY (video_id) REFERENCES studio_videos(id) ON DELETE CASCADE
        )
        """)

        # 7. Aggregated Vehicle Tracks Summary
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS studio_vehicle_tracks (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            video_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            track_id INTEGER NOT NULL,
            vehicle_class TEXT NOT NULL,
            first_timestamp_s REAL NOT NULL,
            last_timestamp_s REAL NOT NULL,
            duration_s REAL NOT NULL,
            avg_speed_kmh REAL,
            max_speed_kmh REAL,
            total_distance_m REAL,
            FOREIGN KEY (job_id) REFERENCES studio_processing_jobs(id) ON DELETE CASCADE
        )
        """)

        # 8. Traffic Density & Time-Series Measurements
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS studio_measurements (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            video_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            region_id TEXT,
            interval_start_s REAL NOT NULL,
            interval_end_s REAL NOT NULL,
            vehicle_count INTEGER NOT NULL,
            unique_vehicle_count INTEGER NOT NULL,
            density_per_m2 REAL,
            density_per_km2 REAL,
            occupancy_percent REAL,
            avg_speed_kmh REAL,
            median_speed_kmh REAL,
            max_speed_kmh REAL,
            flow_rate_vph REAL,
            congestion_level TEXT,
            class_breakdown_json TEXT,
            FOREIGN KEY (job_id) REFERENCES studio_processing_jobs(id) ON DELETE CASCADE
        )
        """)

        # 9. Video Artifacts & Exports
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS studio_exports (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            job_id TEXT,
            export_type TEXT NOT NULL, -- ANNOTATED_VIDEO, TRAJECTORY_CSV, GEOSPATIAL_CSV, GEOJSON, SUMMARY_JSON, TRAFFIC_STATS_CSV, ANALYSIS_REPORT_PDF
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size_bytes INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (video_id) REFERENCES studio_videos(id) ON DELETE CASCADE
        )
        """)

        # 10. DataFromSky External Tracking Log Imports & Provenance
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS studio_datafromsky_imports (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            video_id TEXT,
            filename TEXT NOT NULL,
            provider_source TEXT DEFAULT 'DataFromSky FLOW',
            imported_tracks_count INTEGER NOT NULL,
            imported_observations_count INTEGER NOT NULL,
            metadata_json TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES studio_projects(id) ON DELETE CASCADE
        )
        """)

        # Create Indexes for high-speed spatial, temporal & trajectory queries
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_studio_videos_project ON studio_videos(project_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_studio_calib_video ON studio_calibrations(video_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_studio_regions_video ON studio_regions(video_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_studio_jobs_video ON studio_processing_jobs(video_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_studio_trajectories_lookup ON studio_trajectories(video_id, track_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_studio_trajectories_frame ON studio_trajectories(job_id, frame_idx)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_studio_measurements_video ON studio_measurements(video_id, interval_start_s)")

        # Migration safe-checks
        try:
            cursor.execute("ALTER TABLE studio_processing_jobs ADD COLUMN telemetry_metrics_json TEXT")
        except Exception:
            pass

        # Seed initial default reference project if empty
        cursor.execute("SELECT COUNT(*) as cnt FROM studio_projects")
        row = cursor.fetchone()
        if row and row["cnt"] == 0:
            from datetime import datetime, timezone
            now_iso = datetime.now(timezone.utc).isoformat()
            cursor.execute("""
            INSERT INTO studio_projects (
                id, name, description, location, city, state, country,
                road_name, latitude, longitude, crs, status, created_at, updated_at
            ) VALUES (
                'proj-gsv-pilot-01',
                'GSV Campus & Arterial Corridor Video Intelligence Survey',
                'Gati Shakti Vishwavidyalaya multimodal transportation testbed analyzing approach velocity, lane occupancy, and turning counts.',
                'GSV Campus Gateway Corridor, Vadodara / Lucknow Arterial',
                'Vadodara',
                'Gujarat',
                'India',
                'Lalbaug High-Density Arterial Link',
                22.3072,
                73.1812,
                'EPSG:32643 (WGS 84 / UTM Zone 43N)',
                'ACTIVE',
                ?,
                ?
            )
            """, (now_iso, now_iso))
            logger.info("Seeded default Video Intelligence Studio reference project: proj-gsv-pilot-01")
