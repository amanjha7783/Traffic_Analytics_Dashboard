"""
Feature Engineering module for Travel Time Prediction.

Extracts time, calendar, and road infrastructure features without target leakage.
"""
from datetime import datetime
from typing import Dict, List, Any, Optional
import pandas as pd
import numpy as np

# Road segment ID to integer mapping
ROAD_ENCODING: Dict[str, int] = {
    "RS-01": 1,
    "RS-02": 2,
    "RS-03": 3,
    "RS-04": 4,
    "RS-05": 5,
    "RS-06": 6,
    "RS-07": 7,
    "RS-08": 8,
}

FEATURE_COLUMNS = [
    "hour",
    "day_of_week",
    "is_weekend",
    "is_peak_hour",
    "road_length_km",
    "num_lanes",
    "speed_limit_kmh",
    "road_segment_code",
    "volume",
]


def extract_features_from_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Extract model input features from a raw record or timestamp request."""
    ts = record.get("timestamp")
    if isinstance(ts, str):
        try:
            dt = datetime.fromisoformat(ts)
        except Exception:
            dt = datetime.now()
    elif isinstance(ts, datetime):
        dt = ts
    else:
        dt = datetime.now()

    hour = dt.hour
    day_of_week = dt.weekday()
    is_weekend = 1 if day_of_week >= 5 else 0
    is_peak = 1 if (8 <= hour <= 10 or 17 <= hour <= 20) else 0

    r_id = record.get("road_segment_id", "RS-01")
    code = ROAD_ENCODING.get(r_id, 1)

    return {
        "hour": hour,
        "day_of_week": day_of_week,
        "is_weekend": is_weekend,
        "is_peak_hour": is_peak,
        "road_length_km": float(record.get("road_length_km", 3.0)),
        "num_lanes": int(record.get("num_lanes", 4)),
        "speed_limit_kmh": float(record.get("speed_limit_kmh", 50.0)),
        "road_segment_code": code,
        "volume": int(record.get("volume", 800)),
    }


def prepare_features_df(records: List[Dict[str, Any]]) -> pd.DataFrame:
    """Transform a list of raw records into a feature DataFrame."""
    rows = [extract_features_from_record(r) for r in records]
    df = pd.DataFrame(rows)
    return df[FEATURE_COLUMNS]
