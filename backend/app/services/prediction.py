"""
Prediction Service for Traffic Forecasting.

Provides travel-time, speed, and volume predictions using a trained XGBoost model
or an empirical historical baseline when the model is not yet trained.
All predictions are clearly marked with their provenance and confidence.
"""
import os
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
import joblib
from app.services.feature_engineering import extract_features_from_record, FEATURE_COLUMNS
from app.services.traffic_data import get_road_by_id, ROAD_SEGMENTS, get_hourly_pattern
from app.models.traffic import HourlyForecast, TwentyFourHourForecastResponse, TrafficForecastResponse, ModelInfoResponse

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models")
MODEL_PATH = os.path.join(MODELS_DIR, "xgboost_travel_time.joblib")
META_PATH = os.path.join(MODELS_DIR, "model_metadata.json")

_loaded_model = None
_model_metadata: Optional[Dict] = None


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
    Predict traffic conditions for a given road segment and timestamp.
    """
    road = get_road_by_id(road_segment_id) or ROAD_SEGMENTS[0]
    r_id = road["road_segment_id"]

    try:
        dt = datetime.fromisoformat(timestamp_str)
    except Exception:
        dt = datetime.now()

    hour = dt.hour
    is_weekend = dt.weekday() >= 5

    # Estimate volume based on road capacity and time pattern
    if 8 <= hour <= 10:
        vol_ratio = 0.90 if not is_weekend else 0.55
    elif 17 <= hour <= 20:
        vol_ratio = 0.95 if not is_weekend else 0.70
    elif 12 <= hour <= 15:
        vol_ratio = 0.60
    elif hour >= 22 or hour <= 5:
        vol_ratio = 0.15
    else:
        vol_ratio = 0.45

    volume_est = int(road["capacity_vph"] * vol_ratio)

    model = load_model()
    if model is not None:
        # Extract features
        rec = {
            "timestamp": dt.isoformat(),
            "road_segment_id": r_id,
            "road_length_km": road["road_length_km"],
            "num_lanes": road["num_lanes"],
            "speed_limit_kmh": road["speed_limit_kmh"],
            "volume": volume_est,
        }
        feat_dict = extract_features_from_record(rec)
        import pandas as pd
        X = pd.DataFrame([feat_dict])[FEATURE_COLUMNS]
        pred_tt = float(model.predict(X)[0])
        pred_tt = max(10.0, pred_tt)
        # Derived predicted speed: (length / (tt / 3600))
        pred_spd = (road["road_length_km"] / (pred_tt / 3600.0))
        pred_spd = min(road["speed_limit_kmh"] * 1.1, max(5.0, pred_spd))
        source_note = "XGBoost Regression Model (Trained on demo dataset)"
    else:
        # Empirical baseline calculation
        # speed = free_flow_speed / (1 + 0.45 * (vol / cap)^3.5)
        alpha = 0.45
        beta = 3.5
        vc = volume_est / road["capacity_vph"]
        speed_est = road["base_free_flow_speed"] / (1.0 + alpha * (vc ** beta))
        speed_est = max(10.0, min(road["speed_limit_kmh"], speed_est))
        pred_tt = (road["road_length_km"] / speed_est) * 3600.0
        pred_spd = speed_est
        source_note = "Empirical BPR Baseline Model (Demo parameters)"

    return {
        "road_segment_id": r_id,
        "road_name": road["road_name"],
        "timestamp": dt.isoformat(),
        "predicted_travel_time_seconds": round(pred_tt, 1),
        "predicted_speed_kmh": round(pred_spd, 1),
        "predicted_volume": volume_est,
        "confidence_note": source_note,
        "data_source": "SIMULATED DEMO DATA — Not real measurements",
        "is_demo_data": True,
    }


def get_24_hour_forecast(road_segment_id: str, date_str: Optional[str] = None) -> TwentyFourHourForecastResponse:
    """Generate hourly predictions for an entire 24-hour day."""
    road = get_road_by_id(road_segment_id) or ROAD_SEGMENTS[0]
    r_id = road["road_segment_id"]

    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")

    forecasts: List[HourlyForecast] = []
    for h in range(24):
        ts = f"{date_str}T{h:02d}:00:00"
        pred = predict_traffic_point(r_id, ts)
        forecasts.append(
            HourlyForecast(
                hour=h,
                timestamp=ts,
                predicted_travel_time_seconds=pred["predicted_travel_time_seconds"],
                predicted_speed_kmh=pred["predicted_speed_kmh"],
                predicted_volume=pred["predicted_volume"],
            )
        )

    return TwentyFourHourForecastResponse(
        road_segment_id=r_id,
        road_name=road["road_name"],
        date=date_str,
        forecasts=forecasts,
        data_source="SIMULATED DEMO DATA — Not real measurements",
        is_demo_data=True,
    )


def get_model_info() -> ModelInfoResponse:
    """Get metadata and evaluation metrics of the prediction model."""
    load_model()
    if _model_metadata:
        return ModelInfoResponse(
            model_type=_model_metadata.get("model_type", "XGBoost Regressor"),
            features_used=_model_metadata.get("features_used", FEATURE_COLUMNS),
            training_records=_model_metadata.get("training_records", 0),
            mae=_model_metadata.get("mae", 0.0),
            rmse=_model_metadata.get("rmse", 0.0),
            r2_score=_model_metadata.get("r2_score", 0.0),
            training_date=_model_metadata.get("training_date", "N/A"),
            note="Model trained on SIMULATED DEMO DATA. Metrics reflect demo dataset performance only.",
        )
    return ModelInfoResponse(
        model_type="Empirical Baseline (Model not yet serialized)",
        features_used=FEATURE_COLUMNS,
        training_records=0,
        mae=0.0,
        rmse=0.0,
        r2_score=0.0,
        training_date="N/A",
        note="Baseline heuristic active until training script completes.",
    )
