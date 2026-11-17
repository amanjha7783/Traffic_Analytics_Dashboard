import os
import sys

import numpy as np
import csv
import json
from types import SimpleNamespace

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.geospatial.camera_calibration import compute_homography, vehicle_footprint
from app.main import app
from app.database import database
from app.routes import video_processing as video_processing_routes
from app.traffic.calculations import average_speed_kmh, road_occupancy, traffic_density
from app.vision.video_processor import _crossed_line
from app.vision.vehicle_classifier import refine_classification
from app.vision.detector import Detection
from app.vision.tracker import VehicleTracker
from app.vision import video_processor as video_processor_module
from fastapi.testclient import TestClient

client = TestClient(app)


def test_corridor_router_is_registered():
    response = client.get("/api/corridors")
    assert response.status_code == 200
    assert "corridors" in response.json()


def test_corridor_requires_distinct_cameras():
    response = client.post(
        "/api/corridors",
        json={
            "name": "Same camera corridor",
            "camera_a_id": "camera-1",
            "camera_b_id": "camera-1",
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "A corridor requires two distinct cameras"


def test_camera_api_never_exposes_stream_urls_or_local_paths():
    response = client.get("/api/cameras")
    assert response.status_code == 200
    for camera in response.json()["cameras"]:
        assert "rtsp_url" not in camera
        assert "stream_url" not in camera
        assert "file_path" not in camera

def test_model_catalog_reports_three_wheeler_as_unavailable():
    response = client.get("/api/video-processing/models")
    assert response.status_code == 200
    model = response.json()["models"][0]
    assert "THREE-WHEELER" in model["unavailable_categories"]
    assert "THREE-WHEELER" not in model["supported_categories"]


def test_video_upload_rejects_mismatched_mime_type():
    response = client.post(
        "/api/video-processing",
        files={"file": ("recording.mp4", b"not-video", "text/plain")},
    )
    assert response.status_code == 415
    assert "does not match" in response.json()["detail"]


def test_latest_completed_video_endpoint_returns_annotated_export(tmp_path, monkeypatch):
    db_path = tmp_path / "latest-video.sqlite"
    output_dir = tmp_path / "exports"
    output_dir.mkdir()
    video_path = output_dir / "annotated.mp4"
    video_path.write_bytes(b"video")
    summary_path = output_dir / "processing_summary.json"
    summary_path.write_text(
        json.dumps({"video_filename": "recording.mp4", "category_counts": {"BUS": 2}}),
        encoding="utf-8",
    )
    monkeypatch.setattr(database, "DB_PATH", str(db_path))
    monkeypatch.setattr(database, "DB_DIR", str(tmp_path))
    monkeypatch.setattr(video_processing_routes, "OUTPUT_DIR", output_dir)
    database.init_db()
    with database.get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO video_processing_sessions (
                session_id, video_name, camera_id, video_source_path, status,
                annotated_video_path, processing_summary_json, start_time, end_time
            ) VALUES ('completed-session', 'recording.mp4', 'uploaded-video',
                      'private-source-path', 'COMPLETED', ?, ?, '2026-01-01', '2026-01-02')
            """,
            (str(video_path), str(summary_path)),
        )
        conn.execute(
            """
            UPDATE video_processing_sessions
            SET count_summary_csv = ?, track_details_csv = ?, minute_wise_csv = ?,
                output_directory = ?
            WHERE session_id = 'completed-session'
            """,
            (
                str(output_dir / "count-summary.csv"),
                str(output_dir / "track-details.csv"),
                str(output_dir / "minute-counts.csv"),
                str(output_dir),
            ),
        )
        conn.execute(
            """
            INSERT INTO video_processing_sessions (
                session_id, video_name, camera_id, video_source_path, status,
                start_time, end_time
            ) VALUES ('failed-session', 'failed.mp4', 'uploaded-video',
                      'private-source-path', 'FAILED', '2026-01-03', '2026-01-04')
            """
        )

    response = client.get("/api/video-processing/latest")
    assert response.status_code == 200
    result = response.json()
    assert result["session_id"] == "completed-session"
    assert result["summary"]["category_counts"]["BUS"] == 2
    assert result["exports"]["annotated_video"].endswith("/files/annotated_video")
    private_fields = {
        "annotated_video_path",
        "count_summary_csv",
        "track_details_csv",
        "minute_wise_csv",
        "processing_summary_json",
        "output_directory",
    }
    assert private_fields.isdisjoint(result)
    assert "private-source-path" not in response.text
    assert str(output_dir) not in response.text
    status_response = client.get("/api/video-processing/completed-session")
    assert status_response.status_code == 200
    assert private_fields.isdisjoint(status_response.json())
    assert str(output_dir) not in status_response.text
    media_response = client.get(result["exports"]["annotated_video"])
    assert media_response.status_code == 200
    assert media_response.headers["content-disposition"].startswith("inline;")


def test_latest_completed_video_falls_back_to_existing_disk_exports(tmp_path, monkeypatch):
    output_dir = tmp_path / "exports"
    job_dir = output_dir / "completed-job"
    job_dir.mkdir(parents=True)
    video_path = job_dir / "annotated_browser.mp4"
    video_path.write_bytes(b"browser-video")
    (job_dir / "vehicle_count_summary.csv").write_text("class,count\nBUS,2\n", encoding="utf-8")
    (job_dir / "processing_summary.json").write_text(
        json.dumps({
            "session_id": "completed-job",
            "status": "COMPLETED",
            "video_filename": "recording.mp4",
            "category_counts": {"BUS": 2},
        }),
        encoding="utf-8",
    )

    class ReadableVideo:
        def __init__(self, _path):
            pass

        def isOpened(self):
            return True

        def get(self, property_id):
            return {
                video_processing_routes.cv2.CAP_PROP_FRAME_WIDTH: 640,
                video_processing_routes.cv2.CAP_PROP_FRAME_HEIGHT: 360,
                video_processing_routes.cv2.CAP_PROP_FPS: 10,
                video_processing_routes.cv2.CAP_PROP_FRAME_COUNT: 20,
            }.get(property_id, 0)

        def read(self):
            return True, np.zeros((2, 2, 3), dtype=np.uint8)

        def release(self):
            pass

    monkeypatch.setattr(video_processing_routes, "OUTPUT_DIR", output_dir)
    monkeypatch.setattr(
        video_processing_routes, "PRIMARY_ANNOTATED_VIDEO_PATH", video_path
    )
    monkeypatch.setattr(
        video_processing_routes, "get_latest_completed_video_session", lambda: None
    )
    monkeypatch.setattr(video_processing_routes.cv2, "VideoCapture", ReadableVideo)

    response = client.get("/api/video-processing/latest")
    assert response.status_code == 200
    result = response.json()
    assert result["session_id"] == "completed-job"
    assert result["summary"]["category_counts"]["BUS"] == 2
    assert "count_summary" in result["exports"]
    assert "annotated_video" in result["exports"]
    assert str(output_dir) not in response.text

    csv_response = client.get(result["exports"]["count_summary"])
    assert csv_response.status_code == 200
    assert csv_response.text == "class,count\nBUS,2\n"
    video_response = client.get(result["exports"]["annotated_video"])
    assert video_response.status_code == 200
    assert video_response.content == b"browser-video"


def test_annotated_recordings_are_distinct_and_support_byte_ranges(tmp_path, monkeypatch):
    output_dir = tmp_path / "exports"
    primary_dir = output_dir / "primary-job"
    second_dir = output_dir / "second-job"
    primary_dir.mkdir(parents=True)
    second_dir.mkdir()
    primary_path = primary_dir / "annotated_browser.mp4"
    primary_path.write_bytes(b"primary-video-bytes")
    (primary_dir / "annotated.mp4").write_bytes(b"same-job-alternative")
    second_path = second_dir / "annotated.mp4"
    second_path.write_bytes(b"second-video-bytes")
    (primary_dir / "processing_summary.json").write_text(
        json.dumps({
            "session_id": "primary-job",
            "status": "COMPLETED",
            "category_counts": {"CAR": 1},
            "total_motor_vehicles": 1,
        }),
        encoding="utf-8",
    )
    (second_dir / "processing_summary.json").write_text(
        json.dumps({
            "session_id": "second-job",
            "status": "PARTIAL",
            "is_partial": True,
            "category_counts": {"BUS": 2},
        }),
        encoding="utf-8",
    )

    class ReadableVideo:
        def __init__(self, _path):
            pass

        def isOpened(self):
            return True

        def get(self, property_id):
            return {
                video_processing_routes.cv2.CAP_PROP_FRAME_WIDTH: 640,
                video_processing_routes.cv2.CAP_PROP_FRAME_HEIGHT: 360,
                video_processing_routes.cv2.CAP_PROP_FPS: 10,
                video_processing_routes.cv2.CAP_PROP_FRAME_COUNT: 20,
            }.get(property_id, 0)

        def read(self):
            return True, np.zeros((2, 2, 3), dtype=np.uint8)

        def release(self):
            pass

    monkeypatch.setattr(video_processing_routes, "OUTPUT_DIR", output_dir)
    monkeypatch.setattr(
        video_processing_routes, "PRIMARY_ANNOTATED_VIDEO_PATH", primary_path
    )
    monkeypatch.setattr(video_processing_routes.cv2, "VideoCapture", ReadableVideo)

    response = client.get("/api/video-processing/recordings")
    assert response.status_code == 200
    recordings = response.json()["recordings"]
    assert [item["recording_id"] for item in recordings] == ["primary-job", "second-job"]
    assert recordings[0]["available"] is True
    assert recordings[1]["summary"]["is_partial"] is True
    assert recordings[0]["stream_url"] != recordings[1]["stream_url"]
    assert str(output_dir) not in response.text

    ranged = client.get(
        recordings[1]["stream_url"],
        headers={"Range": "bytes=2-7"},
    )
    assert ranged.status_code == 206
    assert ranged.content == b"cond-v"
    assert ranged.headers["content-range"] == f"bytes 2-7/{second_path.stat().st_size}"
    assert ranged.headers["content-type"].startswith("video/mp4")
    assert ranged.headers["accept-ranges"] == "bytes"

    invalid_range = client.get(
        recordings[1]["stream_url"],
        headers={"Range": f"bytes={second_path.stat().st_size}-"},
    )
    assert invalid_range.status_code == 416
    assert client.get("/api/video-processing/recordings/not-a-job/stream").status_code == 404


def test_missing_second_annotated_video_has_explicit_unavailable_state(tmp_path, monkeypatch):
    output_dir = tmp_path / "exports"
    job_dir = output_dir / "primary-job"
    job_dir.mkdir(parents=True)
    primary_path = job_dir / "annotated_browser.mp4"
    primary_path.write_bytes(b"primary-video")

    class ReadableVideo:
        def __init__(self, _path):
            pass

        def isOpened(self):
            return True

        def get(self, property_id):
            return {
                video_processing_routes.cv2.CAP_PROP_FRAME_WIDTH: 640,
                video_processing_routes.cv2.CAP_PROP_FRAME_HEIGHT: 360,
                video_processing_routes.cv2.CAP_PROP_FPS: 10,
                video_processing_routes.cv2.CAP_PROP_FRAME_COUNT: 20,
            }.get(property_id, 0)

        def read(self):
            return True, np.zeros((2, 2, 3), dtype=np.uint8)

        def release(self):
            pass

    monkeypatch.setattr(video_processing_routes, "OUTPUT_DIR", output_dir)
    monkeypatch.setattr(
        video_processing_routes, "PRIMARY_ANNOTATED_VIDEO_PATH", primary_path
    )
    monkeypatch.setattr(video_processing_routes.cv2, "VideoCapture", ReadableVideo)

    response = client.get("/api/video-processing/recordings")
    assert response.status_code == 200
    recordings = response.json()["recordings"]
    assert recordings[0]["available"] is True
    assert recordings[1]["available"] is False
    assert "Second annotated video not available" in recordings[1]["error"]


def test_calibration_api_returns_saved_homography_and_control_points(tmp_path, monkeypatch):
    db_path = tmp_path / "calibration.sqlite"
    monkeypatch.setattr(database, "DB_PATH", str(db_path))
    monkeypatch.setattr(database, "DB_DIR", str(tmp_path))
    database.init_db()
    with database.get_db_connection() as conn:
        for camera_id in ("camera-a", "camera-b"):
            conn.execute(
                """
                INSERT INTO cameras (id, name, junction, code, created_at, updated_at)
                VALUES (?, ?, 'Junction', ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
                """,
                (camera_id, camera_id, camera_id),
            )
        conn.execute(
            """
            INSERT INTO traffic_corridors (
                id, name, camera_a_id, camera_b_id, road_name, road_length_m, created_at
            ) VALUES ('corridor-test', 'Test corridor', 'camera-a', 'camera-b',
                      'Test road', 1000, '2026-01-01T00:00:00Z')
            """
        )

    image_points = [[0, 0], [100, 0], [100, 100], [0, 100]]
    ground_points = [[0, 0], [10, 0], [10, 10], [0, 10]]
    calibrated = client.post(
        "/api/corridors/corridor-test/calibration",
        json={
            "camera_id": "camera-a",
            "image_points": image_points,
            "ground_points_m": ground_points,
        },
    )
    assert calibrated.status_code == 200
    assert len(calibrated.json()["homography"]) == 3

    corridor = client.get("/api/corridors/corridor-test")
    assert corridor.status_code == 200
    saved = next(
        item for item in corridor.json()["calibrations"]
        if item["camera_id"] == "camera-a"
    )
    assert len(saved["homography_matrix"]) == 3
    assert saved["ground_control_points"] == {
        "image_points": image_points,
        "ground_points_m": ground_points,
    }


def test_forecast_rejects_unknown_roads_and_bad_timestamps():
    assert client.get(
        "/api/traffic/forecast",
        params={"road_segment_id": "not-a-road", "timestamp": "2026-10-25T10:00:00"},
    ).status_code == 404
    assert client.get(
        "/api/traffic/forecast",
        params={"road_segment_id": "RS-01", "timestamp": "not-a-timestamp"},
    ).status_code == 422


def test_forecast_uses_historical_baseline_when_xgboost_is_worse():
    response = client.get(
        "/api/traffic/forecast",
        params={"road_segment_id": "RS-01", "timestamp": "2026-10-25T10:00:00"},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["predicted_volume"] > 0
    assert result["predicted_travel_time_seconds"] > 0
    assert "historical same-hour baseline" in result["confidence_note"].lower()
    assert result["is_demo_data"] is True


def test_vehicle_shape_does_not_infer_three_wheeler():
    assert refine_classification("FOUR-WHEELER", (0, 0, 20, 100), 0.2, 2000) == "FOUR-WHEELER"
    assert refine_classification("OTHER", (0, 0, 100, 20), 5.0, 2000) == "OTHER"


def test_counting_line_requires_a_finite_segment_intersection():
    line = ((0, 10), (10, 10))
    assert _crossed_line((5, 5), (5, 15), line)
    assert not _crossed_line((15, 5), (15, 15), line)

def test_browser_video_encoder_replaces_video_only_after_validation(tmp_path, monkeypatch):
    source = tmp_path / "annotated.mp4"
    source.write_bytes(b"opencv-video")
    commands = []

    def fake_run(command, **_kwargs):
        commands.append(command)
        with open(command[-1], "wb") as encoded:
            encoded.write(b"h264-video")
        return SimpleNamespace(returncode=0, stderr="")

    class ValidVideo:
        def isOpened(self):
            return True

        def read(self):
            return True, np.zeros((2, 2, 3), dtype=np.uint8)

        def release(self):
            pass

    monkeypatch.setattr(video_processor_module.subprocess, "run", fake_run)
    monkeypatch.setattr(video_processor_module.cv2, "VideoCapture", lambda _path: ValidVideo())

    video_processor_module._encode_browser_compatible_video(str(source))

    assert source.read_bytes() == b"h264-video"
    assert "libx264" in commands[0]
    assert "-movflags" in commands[0]
    assert not (tmp_path / "annotated.h264.mp4").exists()


def test_calibrated_metrics_return_unavailable_without_required_inputs():
    assert average_speed_kmh(1000, 60) == 60
    assert average_speed_kmh(1000, 0) is None
    assert traffic_density(10, None)["vehicles_per_km"] is None
    assert road_occupancy([], []) is None
    occupied = road_occupancy(
        [
            [(0, 0), (6, 0), (6, 5), (0, 5)],
            [(4, 0), (10, 0), (10, 5), (4, 5)],
        ],
        [(0, 0), (10, 0), (10, 10), (0, 10)],
    )
    assert occupied == 50


def test_homography_and_footprint_require_calibration_and_dimensions():
    image_points = [(0, 0), (10, 0), (10, 10), (0, 10)]
    ground_points = [(0, 0), (10, 0), (10, 10), (0, 10)]
    matrix, error = compute_homography(image_points, ground_points)
    assert error < 1e-6
    assert vehicle_footprint((1, 1, 5, 8), None, 4, 2, (1, 0)) is None
    footprint = vehicle_footprint((1, 1, 5, 8), matrix, 4, 2, (1, 0))
    assert footprint is not None
    assert np.isfinite(np.asarray(footprint)).all()


def test_video_processor_exports_unique_tracks_crossings_and_minute_counts(tmp_path, monkeypatch):
    source = tmp_path / "input.mp4"
    source.write_bytes(b"test")
    output_dir = tmp_path / "exports"
    written_frames = []
    saved = {}

    class FakeCapture:
        def __init__(self, _path):
            self.index = 0

        def isOpened(self):
            return True

        def get(self, prop):
            return {
                video_processor_module.cv2.CAP_PROP_FRAME_WIDTH: 64,
                video_processor_module.cv2.CAP_PROP_FRAME_HEIGHT: 64,
                video_processor_module.cv2.CAP_PROP_FPS: 1,
                video_processor_module.cv2.CAP_PROP_FRAME_COUNT: 6,
            }.get(prop, 0)

        def read(self):
            if self.index >= 6:
                return False, None
            self.index += 1
            return True, np.zeros((64, 64, 3), dtype=np.uint8)

        def release(self):
            pass

    class FakeWriter:
        def __init__(self, *_args):
            pass

        def isOpened(self):
            return True

        def write(self, frame):
            written_frames.append(frame)

        def release(self):
            pass

    class FakeDetector:
        def is_ready(self):
            return True

        def detect(self, _frame):
            frame_index = len(written_frames)
            y = min(frame_index * 4, 30)
            return [Detection((20, y, 40, y + 10), 0.9, "FOUR-WHEELER", 2, 6.8, (255, 0, 0))]

    monkeypatch.setattr(video_processor_module, "OUTPUT_DIR", output_dir)
    monkeypatch.setattr(video_processor_module, "SUMMARY_DURATION_SECONDS", 1)
    monkeypatch.setattr(video_processor_module, "_encode_browser_compatible_video", lambda _path: None)
    monkeypatch.setattr(video_processor_module.cv2, "VideoCapture", FakeCapture)
    monkeypatch.setattr(video_processor_module.cv2, "VideoWriter", FakeWriter)
    monkeypatch.setattr(video_processor_module, "update_video_session", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        video_processor_module,
        "save_video_tracks",
        lambda _session, _camera, tracks: saved.update(tracks=tracks),
    )
    monkeypatch.setattr(
        video_processor_module,
        "save_video_minute_counts",
        lambda _session, minutes: saved.update(minutes=minutes),
    )

    result = video_processor_module.VideoProcessor(
        detector=FakeDetector(), tracker=VehicleTracker(min_hits=3)
    ).process_video(
        "test-session",
        str(source),
        counting_line=((0, 15), (63, 15)),
    )

    assert result["status"] == "COMPLETED"
    assert result["confirmed_unique_tracks"] == 1
    assert result["counted_crossings"] == 1
    assert result["category_counts"]["FOUR-WHEELER"] == 1
    assert len(saved["tracks"]) == 1
    assert saved["tracks"][0]["counted_crossing"] is True
    assert saved["minutes"][0]["FOUR-WHEELER"] == 1
    assert len(written_frames) == 7

    with open(result["exports"]["count_summary_csv"], newline="", encoding="utf-8") as file:
        summary_rows = list(csv.DictReader(file))
    count_row = next(row for row in summary_rows if row["class"] == "FOUR-WHEELER")
    assert count_row["unique_count"] == "1"
    with open(result["exports"]["minute_wise_csv"], newline="", encoding="utf-8") as file:
        minute_rows = list(csv.DictReader(file))
    assert minute_rows[0]["minute_start_offset_seconds"] == "0"
    assert minute_rows[0]["recording_timestamp"] == ""
    with open(result["exports"]["processing_summary_json"], encoding="utf-8") as file:
        assert json.load(file)["category_counts"]["FOUR-WHEELER"] == 1
