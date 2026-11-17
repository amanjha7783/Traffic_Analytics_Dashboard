import os
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _configured_path(name: str, default: Path) -> Path:
    value = Path(os.getenv(name, str(default)))
    return value.resolve() if value.is_absolute() else (BACKEND_DIR / value).resolve()


DATA_DIR = _configured_path("TRAFFIC_DATA_DIR", BACKEND_DIR / "data")
DATABASE_PATH = _configured_path(
    "TRAFFIC_DATABASE_PATH", DATA_DIR / "traffic_analytics.db"
)
MODEL_PATH = _configured_path("TRAFFIC_MODEL_PATH", DATA_DIR / "yolov8n.onnx")
OUTPUT_DIR = _configured_path("TRAFFIC_OUTPUT_DIR", DATA_DIR / "exports")
MAX_UPLOAD_BYTES = int(os.getenv("TRAFFIC_MAX_UPLOAD_BYTES", str(500 * 1024 * 1024)))
SUMMARY_DURATION_SECONDS = float(os.getenv("TRAFFIC_SUMMARY_DURATION_SECONDS", "5"))
DETECTION_CONFIDENCE = float(os.getenv("TRAFFIC_DETECTION_CONFIDENCE", "0.35"))
DETECTION_IOU = float(os.getenv("TRAFFIC_DETECTION_IOU", "0.45"))
DETECTION_MAX_FPS = float(os.getenv("TRAFFIC_DETECTION_MAX_FPS", "10"))
