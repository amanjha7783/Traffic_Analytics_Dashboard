"""
Prediction Service for Traffic Forecasting.

Provides travel-time, speed, and volume predictions using a trained XGBoost model
or an empirical historical baseline when the model is not yet trained.
All predictions are clearly marked with their provenance and confidence.
"""
import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import joblib
from app.services.feature_engineering import extract_features_from_record, FEATURE_COLUMNS
from app.services.traffic_data import get_road_by_id, ROAD_SEGMENTS, load_traffic_data
from app.models.traffic import HourlyForecast, TwentyFourHourForecastResponse, TrafficForecastResponse, ModelInfoResponse

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models")
MODEL_PATH = os.path.join(MODELS_DIR, "xgboost_travel_time.joblib")
META_PATH = os.path.join(MODELS_DIR, "model_metadata.json")

_loaded_model = None
_model_metadata: Optional[Dict] = None


def _utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def load_model():
    """Load the trained XGBoost model and metadata if available."""
    global _loaded_model, _model_metadata
    if _loaded_model is not None:
        return _loaded_model

    if os.path.exists(MODEL_PATH):
        try:
            _loaded_model = joblib.load(MODEL_PATH)
            logger.info(f"Loaded trained XGBoost model from {MODEL_PATH}")
        except Exception as e:
            logger.error(f"Error loading model from {MODEL_PATH}: {e}")
            _loaded_model = None

    if os.path.exists(META_PATH):
        try:
            import json
            with open(META_PATH, "r", encoding="utf-8") as f:
                _model_metadata = json.load(f)
        except Exception as e:
            logger.warning(f"Error loading metadata: {e}")

    return _loaded_model


def predict_traffic_point(road_segment_id: str, timestamp_str: str) -> Dict[str, Any]:
    """
    Forecast from strictly earlier observations and select XGBoost only when it
    outperformed the historical baseline on the saved chronological test split.
    """
    road = get_road_by_id(road_segment_id)
    if road is None:
        raise LookupError(f"Unknown road segment: {road_segment_id}")
    r_id = road["road_segment_id"]

    try:
        dt = _utc_datetime(datetime.fromisoformat(timestamp_str))
    except ValueError as exc:
        raise ValueError("timestamp must be a valid ISO-8601 datetime") from exc

    history = []
    for record in load_traffic_data():
        if record["road_segment_id"] != r_id:
            continue
        record_time = _utc_datetime(datetime.fromisoformat(record["timestamp"]))
        if record_time < dt:
            history.append((record_time, record))
    comparable = [
        record for record_time, record in history
        if record_time.hour == dt.hour and record_time.weekday() == dt.weekday()
    ]
    if not comparable:
        comparable = [record for record_time, record in history if record_time.hour == dt.hour]
    if not comparable:
        raise LookupError("Not enough earlier observations for this road/time; no forecast was fabricated")

    volume_est = round(sum(item["volume"] for item in comparable) / len(comparable))
    baseline_travel_time = sum(
        item["travel_time_seconds"] for item in comparable
    ) / len(comparable)
    observed_length_km = sum(item["road_length_km"] for item in comparable) / len(comparable)
    observed_lanes = round(sum(item["num_lanes"] for item in comparable) / len(comparable))
    observed_speed_limit = sum(item["speed_limit_kmh"] for item in comparable) / len(comparable)

    model = load_model()
    baseline_metrics = (_model_metadata or {}).get("baseline_metrics", {})
    xgb_metrics = (_model_metadata or {}).get("xgboost_metrics", {})
    use_xgboost = (
        model is not None
        and all(item.get("is_demo_data", True) for item in comparable)
        and xgb_metrics.get("mae") is not None
        and baseline_metrics.get("mae") is not None
        and xgb_metrics["mae"] < baseline_metrics["mae"]
    )
    if use_xgboost:
        # Extract features
        rec = {
            "timestamp": dt.isoformat(),
            "road_segment_id": r_id,
            "road_length_km": observed_length_km,
            "num_lanes": observed_lanes,
            "speed_limit_kmh": observed_speed_limit,
            "volume": volume_est,
        }
        feat_dict = extract_features_from_record(rec)
        import pandas as pd
        X = pd.DataFrame([feat_dict])[FEATURE_COLUMNS]
        pred_tt = float(model.predict(X)[0])
        source_note = "XGBoost selected by lower chronological test MAE"
    else:
        pred_tt = baseline_travel_time
        source_note = f"Historical same-hour baseline ({len(comparable)} prior observations)"
    pred_spd = observed_length_km / (pred_tt / 3600.0) if pred_tt > 0 else None
    is_demo = any(item.get("is_demo_data", True) for item in comparable)

    return {
        "road_segment_id": r_id,
        "road_name": road["road_name"],
        "timestamp": dt.isoformat(),
        "predicted_travel_time_seconds": round(pred_tt, 1),
        "predicted_speed_kmh": round(pred_spd, 1) if pred_spd is not None else None,
        "predicted_volume": volume_est,
        "confidence_note": source_note,
        "data_source": "SIMULATED DEMO DATA — Not real measurements" if is_demo else "IMPORTED HISTORICAL TRAFFIC OBSERVATIONS",
        "is_demo_data": is_demo,
    }


def get_24_hour_forecast(road_segment_id: str, date_str: Optional[str] = None) -> TwentyFourHourForecastResponse:
    """Generate hourly predictions for an entire 24-hour day."""
    road = get_road_by_id(road_segment_id)
    if road is None:
        raise LookupError(f"Unknown road segment: {road_segment_id}")
    r_id = road["road_segment_id"]

    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")

    forecasts: List[HourlyForecast] = []
    provenance_flags = []
    for h in range(24):
        ts = f"{date_str}T{h:02d}:00:00"
        pred = predict_traffic_point(r_id, ts)
        provenance_flags.append(pred["is_demo_data"])
        forecasts.append(
            HourlyForecast(
                hour=h,
                timestamp=ts,
                predicted_travel_time_seconds=pred["predicted_travel_time_seconds"],
                predicted_speed_kmh=pred["predicted_speed_kmh"],
                predicted_volume=pred["predicted_volume"],
            )
        )

    is_demo = any(provenance_flags)
    return TwentyFourHourForecastResponse(
        road_segment_id=r_id,
        road_name=road["road_name"],
        date=date_str,
        forecasts=forecasts,
        data_source="SIMULATED DEMO DATA — Not real measurements" if is_demo else "IMPORTED HISTORICAL TRAFFIC OBSERVATIONS",
        is_demo_data=is_demo,
    )


def get_model_info() -> ModelInfoResponse:
    """Get metadata and evaluation metrics of the prediction model."""
    model = load_model()
    if _model_metadata:
        baseline = _model_metadata.get("baseline_metrics", {})
        xgb_metrics = _model_metadata.get("xgboost_metrics", {})
        use_xgboost = (
            model is not None
            and xgb_metrics.get("mae") is not None
            and baseline.get("mae") is not None
            and xgb_metrics["mae"] < baseline["mae"]
        )
        selected = xgb_metrics if use_xgboost else baseline
        return ModelInfoResponse(
            model_type=(
                _model_metadata.get("model_type", "XGBoost Regressor")
                if use_xgboost
                else "Historical same-hour baseline (selected over XGBoost)"
            ),
            features_used=_model_metadata.get("features_used", FEATURE_COLUMNS),
            training_records=_model_metadata.get("training_records", 0),
            mae=selected.get("mae"),
            rmse=selected.get("rmse"),
            r2_score=selected.get("r2"),
            training_date=_model_metadata.get("training_date", "N/A"),
            note=(
                f"Selected using saved chronological test metrics. No trained deep-learning "
                f"forecast model is configured. "
                f"Dataset is SIMULATED DEMO DATA; XGBoost MAE={xgb_metrics.get('mae')}, "
                f"baseline MAE={baseline.get('mae')}."
            ),
        )
    return ModelInfoResponse(
        model_type="Historical same-hour baseline (no trained model)",
        features_used=FEATURE_COLUMNS,
        training_records=0,
        mae=None,
        rmse=None,
        r2_score=None,
        training_date="N/A",
        note="Historical observations only; no evaluation metrics or deep-learning forecast model are available.",
    )
