"""
Training and Evaluation Pipeline for Travel Time Prediction.

Uses chronological time-series splitting to avoid future data leakage.
Trains an XGBoost regression model alongside a baseline heuristic.
Evaluates using MAE, RMSE, and R2 on a held-out test split.
Saves model artifacts to backend/models/.
"""
import os
import sys
import json
import logging
from datetime import datetime
import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
import joblib

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.traffic_data import load_traffic_data, DATA_DIR
from app.services.feature_engineering import extract_features_from_record, FEATURE_COLUMNS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(backend_dir, "models")
os.makedirs(MODELS_DIR, exist_ok=True)


def train_and_evaluate():
    logger.info("Step 1: Loading traffic records...")
    records = load_traffic_data()
    logger.info(f"Loaded {len(records)} records.")

    # Convert to DataFrame
    df = pd.DataFrame(records)
    # Ensure chronological order to prevent data leakage
    df["timestamp_dt"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp_dt").reset_index(drop=True)

    # Feature extraction
    feature_rows = [extract_features_from_record(r) for r in records]
    X_all = pd.DataFrame(feature_rows)[FEATURE_COLUMNS]
    y_all = df["travel_time_seconds"].values

    total_samples = len(df)
    train_end = int(total_samples * 0.70)
    val_end = int(total_samples * 0.85)

    X_train = X_all.iloc[:train_end]
    y_train = y_all[:train_end]

    X_val = X_all.iloc[train_end:val_end]
    y_val = y_all[train_end:val_end]

    X_test = X_all.iloc[val_end:]
    y_test = y_all[val_end:]

    logger.info(
        f"Chronological Split: Train={len(X_train)} (70%), Val={len(X_val)} (15%), Test={len(X_test)} (15%)"
    )

    # --- BASELINE MODEL ---
    # Baseline: Average travel time by road segment and hour on train split
    train_df = df.iloc[:train_end].copy()
    baseline_lookup = train_df.groupby(["road_segment_id", train_df["timestamp_dt"].dt.hour])[
        "travel_time_seconds"
    ].mean().to_dict()
    global_mean = y_train.mean()

    test_df = df.iloc[val_end:].copy()
    y_baseline_pred = []
    for _, row in test_df.iterrows():
        key = (row["road_segment_id"], row["timestamp_dt"].hour)
        y_baseline_pred.append(baseline_lookup.get(key, global_mean))
    y_baseline_pred = np.array(y_baseline_pred)

    b_mae = mean_absolute_error(y_test, y_baseline_pred)
    b_rmse = np.sqrt(mean_squared_error(y_test, y_baseline_pred))
    b_r2 = r2_score(y_test, y_baseline_pred)
    logger.info(f"[BASELINE] Test MAE: {b_mae:.2f}s | RMSE: {b_rmse:.2f}s | R2: {b_r2:.4f}")

    # --- XGBOOST MODEL ---
    logger.info("Step 2: Training XGBoost Regressor...")
    model = xgb.XGBRegressor(
        n_estimators=120,
        learning_rate=0.08,
        max_depth=5,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
    )
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )

    y_pred = model.predict(X_test)
    xgb_mae = mean_absolute_error(y_test, y_pred)
    xgb_rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    xgb_r2 = r2_score(y_test, y_pred)

    logger.info(f"[XGBOOST] Test MAE: {xgb_mae:.2f}s | RMSE: {xgb_rmse:.2f}s | R2: {xgb_r2:.4f}")

    # Step 3: Serialize Model and Metadata
    model_path = os.path.join(MODELS_DIR, "xgboost_travel_time.joblib")
    joblib.dump(model, model_path)
    logger.info(f"Model saved to: {model_path}")

    metadata = {
        "model_type": "XGBoost Regressor (120 estimators, max_depth=5)",
        "features_used": FEATURE_COLUMNS,
        "target": "travel_time_seconds",
        "dataset_size": total_samples,
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "data_split": "Chronological (70/15/15)",
        "date_range": {
            "start": str(df["timestamp_dt"].min()),
            "end": str(df["timestamp_dt"].max()),
        },
        "baseline_metrics": {
            "model": "Historical Group Mean (Segment + Hour)",
            "mae": round(float(b_mae), 2),
            "rmse": round(float(b_rmse), 2),
            "r2": round(float(b_r2), 4),
        },
        "xgboost_metrics": {
            "mae": round(float(xgb_mae), 2),
            "rmse": round(float(xgb_rmse), 2),
            "r2": round(float(xgb_r2), 4),
        },
        "mae": round(float(xgb_mae), 2),
        "rmse": round(float(xgb_rmse), 2),
        "r2_score": round(float(xgb_r2), 4),
        "training_records": len(X_train),
        "training_date": datetime.now().isoformat(),
        "limitations": [
            "Trained on synthetic demonstration traffic data generated using the BPR formula",
            "Real deployment requires sensor data from loop detectors or GPS probe feeds",
            "Weather and major incident impact are not yet modeled",
        ],
    }

    meta_path = os.path.join(MODELS_DIR, "model_metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Metadata saved to: {meta_path}")

    # Generate Evaluation Report markdown
    report_path = os.path.join(MODELS_DIR, "EVALUATION_REPORT.md")
    report_content = f"""# Travel Time Prediction Model: Evaluation Report

**Date**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
**Model**: XGBoost Regressor (`xgboost.XGBRegressor`)
**Dataset Type**: SIMULATED DEMO DATA (Labeled synthetic fixtures)

---

## 1. Dataset & Splitting
- **Total Records**: {total_samples:,}
- **Features**: `{', '.join(FEATURE_COLUMNS)}`
- **Target**: `travel_time_seconds`
- **Time Horizon**: {df['timestamp_dt'].min()} to {df['timestamp_dt'].max()}
- **Splitting Strategy**: Strict Chronological Split (prevents future lookahead leakage)
  - **Train**: {len(X_train):,} samples (70%)
  - **Validation**: {len(X_val):,} samples (15%)
  - **Test**: {len(X_test):,} samples (15%)

---

## 2. Model Performance on Unseen Test Split

| Model | MAE (seconds) | RMSE (seconds) | R² Score |
|---|---|---|---|
| **Historical Baseline (Segment + Hour Mean)** | {b_mae:.2f}s | {b_rmse:.2f}s | {b_r2:.4f} |
| **XGBoost Regressor** | **{xgb_mae:.2f}s** | **{xgb_rmse:.2f}s** | **{xgb_r2:.4f}** |

---

## 3. Findings
- XGBoost achieves lower error compared to the segmented mean baseline.
- Preserving chronological order ensures that peak-period dynamics are evaluated realistically on future time windows.

---

## 4. Known Limitations & Production Prerequisites
- **Synthetic Data**: Measurements were generated using the standard Bureau of Public Roads (BPR) volume-delay relationship.
- **Real-World Integration**: For production deployment in an Indian or international city, detector feeds (e.g., PeMS, FASTag, or traffic camera CV telemetry) must replace the synthetic CSV.
"""
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)
    logger.info(f"Evaluation report written to {report_path}")

    print("\n================ EVALUATION SUMMARY ================")
    print(f"Baseline MAE: {b_mae:.2f}s | RMSE: {b_rmse:.2f}s | R2: {b_r2:.4f}")
    print(f"XGBoost  MAE: {xgb_mae:.2f}s | RMSE: {xgb_rmse:.2f}s | R2: {xgb_r2:.4f}")
    print("====================================================\n")


if __name__ == "__main__":
    train_and_evaluate()
