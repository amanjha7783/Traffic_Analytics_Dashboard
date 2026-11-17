"""
SQLite Database Connection and Initialization.
Lightweight, thread-safe persistence layer for Two-Camera Traffic Analytics System.
"""
import os
import sqlite3
import logging
from typing import Generator
from contextlib import contextmanager
from app.config import DATABASE_PATH

logger = logging.getLogger(__name__)

DB_DIR = str(DATABASE_PATH.parent)
DB_PATH = str(DATABASE_PATH)


def get_db_path() -> str:
    os.makedirs(DB_DIR, exist_ok=True)
    return DB_PATH


@contextmanager
def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    """Provide a transactional database connection."""
    conn = sqlite3.connect(get_db_path(), timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database transaction error: {e}")
        raise
    finally:
        conn.close()


def init_db():
    """Create all required tables and seed initial reference data."""
    os.makedirs(DB_DIR, exist_ok=True)
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 1. Cameras Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS cameras (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            junction TEXT NOT NULL,
            code TEXT NOT NULL,
            rtsp_url TEXT,
            video_source TEXT DEFAULT 'sample',
            file_path TEXT,
            latitude REAL,
            longitude REAL,
            fps REAL DEFAULT 30.0,
            resolution TEXT DEFAULT '1080p',
            direction TEXT DEFAULT 'Eastbound',
            status TEXT DEFAULT 'ONLINE',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """)

        # 2. Corridors Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS traffic_corridors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            camera_a_id TEXT NOT NULL,
            camera_b_id TEXT NOT NULL,
            road_name TEXT NOT NULL,
            road_length_m REAL NOT NULL,
            road_width_m REAL DEFAULT 14.0,
            num_lanes INTEGER DEFAULT 4,
            speed_limit_kmh REAL DEFAULT 50.0,
            direction TEXT DEFAULT 'Eastbound',
            geometry_geojson TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (camera_a_id) REFERENCES cameras(id),
            FOREIGN KEY (camera_b_id) REFERENCES cameras(id)
        )
        """)

        # 3. Camera Calibrations Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS camera_calibrations (
            id TEXT PRIMARY KEY,
            camera_id TEXT NOT NULL,
            homography_matrix_json TEXT,
            ground_control_points_json TEXT,
            is_calibrated INTEGER DEFAULT 0,
            calibrated_at TEXT,
            FOREIGN KEY (camera_id) REFERENCES cameras(id)
        )
        """)

        # 4. Vehicle Dimension Reference Database
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS vehicle_dimension_reference (
            category TEXT PRIMARY KEY,
            length_m REAL NOT NULL,
            width_m REAL NOT NULL,
            projected_area_m2 REAL NOT NULL,
            min_length_m REAL,
            max_length_m REAL,
            min_width_m REAL,
            max_width_m REAL,
            data_source TEXT DEFAULT 'Standard IRC Urban Highway Dimensions'
        )
        """)

        # 5. Vehicle Tracks Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS vehicle_tracks (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            camera_id TEXT NOT NULL,
            track_id INTEGER NOT NULL,
            vehicle_class TEXT NOT NULL,
            confidence REAL,
            first_seen_timestamp TEXT NOT NULL,
            last_seen_timestamp TEXT NOT NULL,
            total_frames INTEGER DEFAULT 1,
            estimated_speed_kmh REAL,
            estimated_length_m REAL,
            estimated_width_m REAL,
            crossed_counting_line INTEGER DEFAULT 0,
            crossing_timestamp TEXT,
            direction TEXT,
            FOREIGN KEY (camera_id) REFERENCES cameras(id)
        )
        """)

        # 6. Cross-Camera Vehicle Matches Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS cross_camera_matches (
            id TEXT PRIMARY KEY,
            corridor_id TEXT NOT NULL,
            cam_a_track_id INTEGER NOT NULL,
            cam_b_track_id INTEGER NOT NULL,
            vehicle_class TEXT NOT NULL,
            cam_a_timestamp TEXT NOT NULL,
            cam_b_timestamp TEXT NOT NULL,
            travel_time_seconds REAL NOT NULL,
            calculated_speed_kmh REAL NOT NULL,
            match_confidence REAL NOT NULL,
            color_similarity REAL,
            FOREIGN KEY (corridor_id) REFERENCES traffic_corridors(id)
        )
        """)

        # 7. Minute Traffic Aggregates Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS minute_traffic_aggregates (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            corridor_id TEXT NOT NULL,
            camera_a_count INTEGER DEFAULT 0,
            camera_b_count INTEGER DEFAULT 0,
            total_unique_vehicles INTEGER DEFAULT 0,
            two_wheeler_count INTEGER DEFAULT 0,
            three_wheeler_count INTEGER DEFAULT 0,
            four_wheeler_count INTEGER DEFAULT 0,
            bus_count INTEGER DEFAULT 0,
            truck_count INTEGER DEFAULT 0,
            bicycle_count INTEGER DEFAULT 0,
            pedestrian_count INTEGER DEFAULT 0,
            other_count INTEGER DEFAULT 0,
            average_speed_kmh REAL DEFAULT 0.0,
            vehicle_volume_vph INTEGER DEFAULT 0,
            traffic_density_vpkm REAL DEFAULT 0.0,
            traffic_density_per_lane REAL DEFAULT 0.0,
            road_occupancy_percent REAL DEFAULT 0.0,
            average_travel_time_sec REAL DEFAULT 0.0,
            congestion_index REAL DEFAULT 1.0,
            congestion_level TEXT DEFAULT 'Free Flow',
            direction_distribution_json TEXT,
            data_source TEXT DEFAULT 'REAL CCTV',
            is_demo_data INTEGER DEFAULT 0
        )
        """)

        # 8. Video Processing Sessions (Section 22 & 23)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS video_processing_sessions (
            session_id TEXT PRIMARY KEY,
            video_name TEXT NOT NULL,
            camera_id TEXT NOT NULL,
            video_source_path TEXT NOT NULL,
            annotated_video_path TEXT,
            count_summary_csv TEXT,
            track_details_csv TEXT,
            minute_wise_csv TEXT,
            processing_summary_json TEXT,
            status TEXT DEFAULT 'PENDING',
            progress_percent REAL DEFAULT 0.0,
            current_frame INTEGER DEFAULT 0,
            total_frames INTEGER DEFAULT 0,
            fps REAL DEFAULT 0.0,
            total_vehicles_counted INTEGER DEFAULT 0,
            two_wheeler_count INTEGER DEFAULT 0,
            three_wheeler_count INTEGER DEFAULT 0,
            four_wheeler_count INTEGER DEFAULT 0,
            bus_count INTEGER DEFAULT 0,
            truck_count INTEGER DEFAULT 0,
            bicycle_count INTEGER DEFAULT 0,
            other_count INTEGER DEFAULT 0,
            pedestrian_count INTEGER DEFAULT 0,
            start_time TEXT,
            end_time TEXT,
            duration_seconds REAL DEFAULT 0.0,
            counting_line_json TEXT
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS vehicle_count_events (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            camera_id TEXT NOT NULL,
            track_id INTEGER NOT NULL,
            vehicle_class TEXT NOT NULL,
            direction TEXT,
            first_seen_timestamp REAL NOT NULL,
            last_seen_timestamp REAL NOT NULL,
            event_timestamp REAL,
            confidence REAL,
            event_type TEXT NOT NULL,
            UNIQUE(session_id, camera_id, track_id, event_type)
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS video_minute_counts (
            session_id TEXT NOT NULL,
            minute_index INTEGER NOT NULL,
            minute_start_offset_seconds REAL NOT NULL,
            recording_timestamp TEXT,
            counts_json TEXT NOT NULL,
            total_motor_vehicles INTEGER NOT NULL,
            total_vehicles INTEGER NOT NULL,
            crossings INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (session_id, minute_index),
            FOREIGN KEY (session_id) REFERENCES video_processing_sessions(session_id)
        )
        """)

        # Additive migrations keep previously created local databases intact.
        session_columns = {
            "raw_frame_detections": "INTEGER NOT NULL DEFAULT 0",
            "confirmed_unique_tracks": "INTEGER NOT NULL DEFAULT 0",
            "counted_crossings": "INTEGER NOT NULL DEFAULT 0",
            "is_partial": "INTEGER NOT NULL DEFAULT 0",
            "data_source": "TEXT NOT NULL DEFAULT 'RECORDED VIDEO'",
            "processing_fps": "REAL NOT NULL DEFAULT 0",
            "average_confidence": "REAL",
            "output_directory": "TEXT",
            "error_message": "TEXT",
            "source_width": "INTEGER",
            "source_height": "INTEGER",
        }
        existing_columns = {
            row["name"] for row in cursor.execute(
                "PRAGMA table_info(video_processing_sessions)"
            ).fetchall()
        }
        for column, definition in session_columns.items():
            if column not in existing_columns:
                cursor.execute(
                    f"ALTER TABLE video_processing_sessions ADD COLUMN {column} {definition}"
                )

        corridor_columns = {
            row["name"] for row in cursor.execute(
                "PRAGMA table_info(traffic_corridors)"
            ).fetchall()
        }
        if "data_source" not in corridor_columns:
            cursor.execute(
                "ALTER TABLE traffic_corridors ADD COLUMN data_source TEXT NOT NULL DEFAULT 'DEMO_SEED'"
            )
        if "is_demo_data" not in corridor_columns:
            cursor.execute(
                "ALTER TABLE traffic_corridors ADD COLUMN is_demo_data INTEGER NOT NULL DEFAULT 1"
            )
        if "road_width_source" not in corridor_columns:
            cursor.execute(
                "ALTER TABLE traffic_corridors ADD COLUMN road_width_source TEXT"
            )
        if "lane_count_source" not in corridor_columns:
            cursor.execute(
                "ALTER TABLE traffic_corridors ADD COLUMN lane_count_source TEXT"
            )
        calibration_columns = {
            row["name"] for row in cursor.execute(
                "PRAGMA table_info(camera_calibrations)"
            ).fetchall()
        }
        if "reprojection_rmse_m" not in calibration_columns:
            cursor.execute(
                "ALTER TABLE camera_calibrations ADD COLUMN reprojection_rmse_m REAL"
            )
        if "calibration_source" not in calibration_columns:
            cursor.execute(
                "ALTER TABLE camera_calibrations ADD COLUMN calibration_source TEXT"
            )

        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_vehicle_count_events_session
        ON vehicle_count_events(session_id, event_timestamp)
        """)

        # 9. Model Evaluations Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS model_evaluations (
            model_id TEXT PRIMARY KEY,
            model_name TEXT NOT NULL,
            model_type TEXT NOT NULL,
            horizon TEXT NOT NULL,
            target_variable TEXT NOT NULL,
            mae REAL NOT NULL,
            rmse REAL NOT NULL,
            r2_score REAL NOT NULL,
            mape REAL,
            training_samples INTEGER,
            test_samples INTEGER,
            evaluation_date TEXT NOT NULL,
            is_best_model INTEGER DEFAULT 0
        )
        """)

        # 10. System Events Log
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL,
            module TEXT NOT NULL,
            message TEXT NOT NULL,
            details_json TEXT
        )
        """)

        # Seed Reference Vehicle Dimensions if empty
        cursor.execute("SELECT COUNT(*) FROM vehicle_dimension_reference")
        if cursor.fetchone()[0] == 0:
            dimensions = [
                ("TWO-WHEELER", 1.9, 0.8, 1.52, 1.7, 2.2, 0.7, 0.9, "IRC Standard Motorized Two-Wheeler"),
                ("THREE-WHEELER", 2.7, 1.3, 3.51, 2.5, 3.0, 1.2, 1.4, "IRC Auto/E-Rickshaw Standard"),
                ("FOUR-WHEELER", 4.4, 1.8, 7.92, 3.8, 5.0, 1.6, 2.0, "Passenger Car / Sedan / Compact SUV"),
                ("BUS", 11.5, 2.5, 28.75, 9.0, 14.0, 2.4, 2.6, "Standard Urban Transit Bus"),
                ("TRUCK", 8.5, 2.4, 20.40, 6.0, 12.0, 2.2, 2.6, "Medium/Heavy Commercial Goods Vehicle"),
                ("BICYCLE", 1.7, 0.5, 0.85, 1.5, 1.9, 0.4, 0.6, "Standard Bicycle"),
                ("OTHER", 3.5, 1.5, 5.25, 2.0, 6.0, 1.0, 2.2, "Unclassified / Special Purpose Vehicle"),
                ("PEDESTRIAN", 0.5, 0.5, 0.25, 0.4, 0.6, 0.4, 0.6, "Pedestrian (Excluded from Vehicle Count)"),
            ]
            cursor.executemany("""
            INSERT INTO vehicle_dimension_reference 
            (category, length_m, width_m, projected_area_m2, min_length_m, max_length_m, min_width_m, max_width_m, data_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, dimensions)

        logger.info("Database initialized successfully at %s", DB_PATH)


def create_video_session(
    session_id: str,
    video_name: str,
    camera_id: str,
    video_source_path: str,
    total_frames: int,
    fps: float,
    width: int,
    height: int,
    counting_line_json: str | None,
    data_source: str = "RECORDED VIDEO",
) -> None:
    """Persist a newly accepted video-processing session."""
    init_db()
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO video_processing_sessions (
                session_id, video_name, camera_id, video_source_path, status,
                total_frames, fps, counting_line_json, data_source, source_width,
                source_height, start_time
            ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                session_id, video_name, camera_id, video_source_path, total_frames,
                fps, counting_line_json, data_source, width, height,
            ),
        )


def update_video_session(session_id: str, **updates) -> None:
    """Apply a whitelist of state changes to an existing processing session."""
    allowed = {
        "status", "progress_percent", "current_frame", "total_frames", "fps",
        "total_vehicles_counted", "two_wheeler_count", "three_wheeler_count",
        "four_wheeler_count", "bus_count", "truck_count", "bicycle_count",
        "other_count", "pedestrian_count", "annotated_video_path",
        "count_summary_csv", "track_details_csv", "minute_wise_csv",
        "processing_summary_json", "end_time", "duration_seconds",
        "raw_frame_detections", "confirmed_unique_tracks", "counted_crossings",
        "is_partial", "data_source", "processing_fps", "average_confidence",
        "output_directory", "error_message", "source_width", "source_height",
    }
    values = {key: value for key, value in updates.items() if key in allowed}
    if not values:
        return
    assignments = ", ".join(f"{key} = ?" for key in values)
    with get_db_connection() as conn:
        cursor = conn.execute(
            f"UPDATE video_processing_sessions SET {assignments} WHERE session_id = ?",
            (*values.values(), session_id),
        )
        if cursor.rowcount == 0:
            raise KeyError(f"Unknown video processing session: {session_id}")


def get_video_session(session_id: str):
    """Return one session record without exposing its local source path."""
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM video_processing_sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        if row is None:
            return None
        result = dict(row)
        result.pop("video_source_path", None)
        result.pop("counting_line_json", None)
        return result


def get_latest_completed_video_session():
    """Return the newest completed recording that has an annotated video."""
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT session_id
            FROM video_processing_sessions
            WHERE status IN ('COMPLETED', 'PARTIAL')
              AND annotated_video_path IS NOT NULL
            ORDER BY COALESCE(end_time, start_time) DESC, rowid DESC
            LIMIT 1
            """
        ).fetchone()
    return get_video_session(row["session_id"]) if row else None


def save_video_tracks(session_id: str, camera_id: str, tracks: list[dict]) -> None:
    """Persist final unique track records and their count events transactionally."""
    with get_db_connection() as conn:
        for track in tracks:
            track_key = f"{session_id}:{camera_id}:{track['track_id']}"
            conn.execute(
                """
                INSERT OR REPLACE INTO vehicle_tracks (
                    id, session_id, camera_id, track_id, vehicle_class, confidence,
                    first_seen_timestamp, last_seen_timestamp, total_frames,
                    estimated_speed_kmh, crossed_counting_line, crossing_timestamp,
                    direction
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    track_key, session_id, camera_id, track["track_id"],
                    track["class_name"], track.get("confidence"),
                    str(track["first_seen_timestamp"]), str(track["last_seen_timestamp"]),
                    track.get("frames_seen", 1), track.get("speed_kmh"),
                    int(track.get("counted_crossing", False)),
                    str(track.get("crossing_timestamp") or ""),
                    track.get("direction"),
                ),
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO vehicle_count_events (
                    id, session_id, camera_id, track_id, vehicle_class, direction,
                    first_seen_timestamp, last_seen_timestamp, event_timestamp,
                    confidence, event_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unique_track')
                """,
                (
                    track_key, session_id, camera_id, track["track_id"],
                    track["class_name"], track.get("direction"),
                    track["first_seen_timestamp"], track["last_seen_timestamp"],
                    track.get("crossing_timestamp"), track.get("confidence"),
                ),
            )
            if track.get("counted_crossing"):
                conn.execute(
                    """
                    INSERT OR REPLACE INTO vehicle_count_events (
                        id, session_id, camera_id, track_id, vehicle_class, direction,
                        first_seen_timestamp, last_seen_timestamp, event_timestamp,
                        confidence, event_type
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'counting_line_crossing')
                    """,
                    (
                        f"{track_key}:crossing", session_id, camera_id, track["track_id"],
                        track["class_name"], track.get("direction"),
                        track["first_seen_timestamp"], track["last_seen_timestamp"],
                        track.get("crossing_timestamp"), track.get("confidence"),
                    ),
                )


def save_video_minute_counts(
    session_id: str,
    minute_counts: dict[int, dict[str, int]],
) -> None:
    """Persist relative minute counts without inventing recording timestamps."""
    import json

    with get_db_connection() as conn:
        for minute, counts in sorted(minute_counts.items()):
            motor = sum(
                counts.get(name, 0)
                for name in (
                    "TWO-WHEELER", "THREE-WHEELER", "FOUR-WHEELER",
                    "BUS", "TRUCK", "OTHER",
                )
            )
            total = motor + counts.get("BICYCLE", 0)
            conn.execute(
                """
                INSERT OR REPLACE INTO video_minute_counts (
                    session_id, minute_index, minute_start_offset_seconds,
                    recording_timestamp, counts_json, total_motor_vehicles,
                    total_vehicles, crossings
                ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
                """,
                (
                    session_id, minute, minute * 60, json.dumps(counts),
                    motor, total, counts.get("crossings", 0),
                ),
            )


def get_video_minute_counts(session_id: str) -> list[dict]:
    """Return saved minute records in recording-relative time."""
    import json

    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT minute_index, minute_start_offset_seconds, recording_timestamp,
                   counts_json, total_motor_vehicles, total_vehicles, crossings
            FROM video_minute_counts
            WHERE session_id = ?
            ORDER BY minute_index
            """,
            (session_id,),
        ).fetchall()
    return [
        {
            **dict(row),
            "counts": json.loads(row["counts_json"]),
        }
        for row in rows
    ]

if __name__ == "__main__":
    init_db()
    print("Database initialization complete.")
