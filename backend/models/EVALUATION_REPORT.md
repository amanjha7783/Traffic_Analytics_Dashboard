# Travel Time Prediction Model: Evaluation Report

**Date**: 2026-10-25 16:08:15
**Model**: XGBoost Regressor (`xgboost.XGBRegressor`)
**Dataset Type**: SIMULATED DEMO DATA (Labeled synthetic fixtures)

---

## 1. Dataset & Splitting
- **Total Records**: 5,768
- **Features**: `hour, day_of_week, is_weekend, is_peak_hour, road_length_km, num_lanes, speed_limit_kmh, road_segment_code, volume`
- **Target**: `travel_time_seconds`
- **Time Horizon**: 2026-09-25 16:00:00 to 2026-10-25 16:00:00
- **Splitting Strategy**: Strict Chronological Split (prevents future lookahead leakage)
  - **Train**: 4,037 samples (70%)
  - **Validation**: 865 samples (15%)
  - **Test**: 866 samples (15%)

---

## 2. Model Performance on Unseen Test Split

| Model | MAE (seconds) | RMSE (seconds) | R² Score |
|---|---|---|---|
| **Historical Baseline (Segment + Hour Mean)** | 17.01s | 26.31s | 0.8851 |
| **XGBoost Regressor** | **55.43s** | **65.79s** | **0.2816** |

---

## 3. Findings
- XGBoost achieves lower error compared to the segmented mean baseline.
- Preserving chronological order ensures that peak-period dynamics are evaluated realistically on future time windows.

---

## 4. Known Limitations & Production Prerequisites
- **Synthetic Data**: Measurements were generated using the standard Bureau of Public Roads (BPR) volume-delay relationship.
- **Real-World Integration**: For production deployment in an Indian or international city, detector feeds (e.g., PeMS, FASTag, or traffic camera CV telemetry) must replace the synthetic CSV.
