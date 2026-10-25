"""
Traffic Data Service.

Handles loading, generation, and querying of historical traffic records.
All synthetic datasets are clearly labelled as SIMULATED DEMO DATA.
"""
import os
import csv
import json
import random
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from app.models.traffic import (
    RoadSegment,
    TrafficRecord,
    HourlyPattern,
    WeekdayComparison,
    PeakHourInfo,
    CongestionTrendPoint,
    TrafficAnalyticsSummary,
)

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
CSV_PATH = os.path.join(DATA_DIR, "historical_traffic.csv")

# Predefined road segments for Lucknow network
ROAD_SEGMENTS: List[Dict] = [
    {
        "road_segment_id": "RS-01",
        "road_name": "MG Road (Charbagh - Hazratganj)",
        "road_length_km": 2.8,
        "num_lanes": 4,
        "speed_limit_kmh": 40.0,
        "base_free_flow_speed": 38.0,
        "capacity_vph": 1800,
    },
    {
        "road_segment_id": "RS-02",
        "road_name": "Gomti Nagar Link Road",
        "road_length_km": 4.5,
        "num_lanes": 6,
        "speed_limit_kmh": 60.0,
        "base_free_flow_speed": 55.0,
        "capacity_vph": 2800,
    },
    {
        "road_segment_id": "RS-03",
        "road_name": "Faizabad Road Corridor",
        "road_length_km": 5.2,
        "num_lanes": 6,
        "speed_limit_kmh": 60.0,
        "base_free_flow_speed": 54.0,
        "capacity_vph": 2600,
    },
    {
        "road_segment_id": "RS-04",
        "road_name": "Kanpur Road Highway Stretch",
        "road_length_km": 6.0,
        "num_lanes": 6,
        "speed_limit_kmh": 60.0,
        "base_free_flow_speed": 57.0,
        "capacity_vph": 3000,
    },
    {
        "road_segment_id": "RS-05",
        "road_name": "Vidhan Sabha Marg",
        "road_length_km": 2.2,
        "num_lanes": 4,
        "speed_limit_kmh": 35.0,
        "base_free_flow_speed": 32.0,
        "capacity_vph": 1500,
    },
    {
        "road_segment_id": "RS-06",
        "road_name": "Ring Road North Corridor",
        "road_length_km": 7.5,
        "num_lanes": 6,
        "speed_limit_kmh": 70.0,
        "base_free_flow_speed": 66.0,
        "capacity_vph": 3200,
    },
    {
        "road_segment_id": "RS-07",
        "road_name": "Aminabad Market Street",
        "road_length_km": 1.5,
        "num_lanes": 2,
        "speed_limit_kmh": 25.0,
        "base_free_flow_speed": 22.0,
        "capacity_vph": 900,
    },
    {
        "road_segment_id": "RS-08",
        "road_name": "Husainabad Heritage Corridor",
        "road_length_km": 3.1,
        "num_lanes": 4,
        "speed_limit_kmh": 35.0,
        "base_free_flow_speed": 32.0,
        "capacity_vph": 1600,
    },
]

# In-memory cached dataset
_traffic_records: Optional[List[Dict]] = None


def generate_synthetic_historical_data(days: int = 30) -> List[Dict]:
    """
    Generate realistic synthetic historical traffic data.
    Clearly annotated with data_source = 'SIMULATED DEMO DATA'.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    random.seed(42)  # Deterministic generation for reproducible research

    records: List[Dict] = []
    end_date = datetime.now().replace(minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=days)

    current = start_date
    while current <= end_date:
        hour = current.hour
        is_weekend = current.weekday() >= 5  # 5=Sat, 6=Sun

        # Base hourly volume factor (0 to 1)
        if 8 <= hour <= 10:
            # Morning rush
            vol_factor = 0.90 if not is_weekend else 0.55
        elif 12 <= hour <= 15:
            # Mid-day
            vol_factor = 0.60 if not is_weekend else 0.65
        elif 17 <= hour <= 20:
            # Evening rush
            vol_factor = 0.95 if not is_weekend else 0.70
        elif 22 <= hour or hour <= 5:
            # Late night / early morning
            vol_factor = 0.15
        else:
            vol_factor = 0.45

        for road in ROAD_SEGMENTS:
            capacity = road["capacity_vph"]
            free_speed = road["base_free_flow_speed"]
            length_km = road["road_length_km"]

            # Volume calculation with random noise (+/- 10%)
            base_vol = int(capacity * vol_factor * random.uniform(0.9, 1.1))
            volume = max(10, base_vol)

            # Bureau of Public Roads (BPR) congestion formula:
            # speed = free_flow_speed / (1 + alpha * (volume / capacity)^beta)
            alpha = 0.45
            beta = 3.5
            vc_ratio = volume / capacity
            speed_drop = 1.0 + alpha * (vc_ratio ** beta)
            actual_speed = free_speed / speed_drop

            # Add stochastic fluctuation
            actual_speed = max(8.0, min(road["speed_limit_kmh"] * 1.05, actual_speed * random.uniform(0.95, 1.05)))
            travel_time_sec = (length_km / actual_speed) * 3600.0

            rec = {
                "timestamp": current.isoformat(),
                "road_segment_id": road["road_segment_id"],
                "road_name": road["road_name"],
                "speed_kmh": round(actual_speed, 1),
                "volume": volume,
                "travel_time_seconds": round(travel_time_sec, 1),
                "road_length_km": length_km,
                "num_lanes": road["num_lanes"],
                "speed_limit_kmh": road["speed_limit_kmh"],
                "is_demo_data": True,
            }
            records.append(rec)

        current += timedelta(hours=1)

    # Save to CSV
    if records:
        fieldnames = list(records[0].keys())
        with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(records)

    logger.info(f"Generated {len(records)} synthetic traffic records at {CSV_PATH}")
    return records


def load_traffic_data() -> List[Dict]:
    """Load or generate the historical traffic dataset."""
    global _traffic_records
    if _traffic_records is not None:
        return _traffic_records

    if os.path.exists(CSV_PATH):
        records = []
        try:
            with open(CSV_PATH, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    records.append({
                        "timestamp": row["timestamp"],
                        "road_segment_id": row["road_segment_id"],
                        "road_name": row["road_name"],
                        "speed_kmh": float(row["speed_kmh"]),
                        "volume": int(row["volume"]),
                        "travel_time_seconds": float(row["travel_time_seconds"]),
                        "road_length_km": float(row["road_length_km"]),
                        "num_lanes": int(row["num_lanes"]),
                        "speed_limit_kmh": float(row["speed_limit_kmh"]),
                        "is_demo_data": True,
                    })
            if records:
                _traffic_records = records
                return records
        except Exception as e:
            logger.warning(f"Error loading {CSV_PATH}, regenerating: {e}")

    _traffic_records = generate_synthetic_historical_data()
    return _traffic_records


def get_road_segments_list() -> List[RoadSegment]:
    """Get all defined road segments."""
    return [
        RoadSegment(
            road_segment_id=r["road_segment_id"],
            road_name=r["road_name"],
            road_length_km=r["road_length_km"],
            num_lanes=r["num_lanes"],
            speed_limit_kmh=r["speed_limit_kmh"],
        )
        for r in ROAD_SEGMENTS
    ]


def get_road_by_id(road_segment_id: str) -> Optional[Dict]:
    for r in ROAD_SEGMENTS:
        if r["road_segment_id"] == road_segment_id or r["road_name"].lower() == road_segment_id.lower():
            return r
    return None


def get_analytics_summary() -> TrafficAnalyticsSummary:
    """Compute overall analytics summary across the entire dataset."""
    data = load_traffic_data()
    if not data:
        return TrafficAnalyticsSummary(
            total_records=0,
            date_range={"start": "", "end": ""},
            road_segments_count=len(ROAD_SEGMENTS),
            average_speed_kmh=0.0,
            average_travel_time_seconds=0.0,
            average_volume=0,
            busiest_road="N/A",
            peak_hour=18,
            is_demo_data=True,
        )

    speeds = [d["speed_kmh"] for d in data]
    tts = [d["travel_time_seconds"] for d in data]
    vols = [d["volume"] for d in data]

    # Road-wise volume sums
    road_vols: Dict[str, int] = {}
    hour_vols: Dict[int, int] = {}
    for d in data:
        r_name = d["road_name"]
        road_vols[r_name] = road_vols.get(r_name, 0) + d["volume"]
        try:
            h = datetime.fromisoformat(d["timestamp"]).hour
            hour_vols[h] = hour_vols.get(h, 0) + d["volume"]
        except Exception:
            pass

    busiest = max(road_vols.items(), key=lambda x: x[1])[0] if road_vols else "N/A"
    peak_h = max(hour_vols.items(), key=lambda x: x[1])[0] if hour_vols else 18

    return TrafficAnalyticsSummary(
        total_records=len(data),
        date_range={"start": data[0]["timestamp"], "end": data[-1]["timestamp"]},
        road_segments_count=len(ROAD_SEGMENTS),
        average_speed_kmh=round(sum(speeds) / len(speeds), 1),
        average_travel_time_seconds=round(sum(tts) / len(tts), 1),
        average_volume=int(sum(vols) / len(vols)),
        busiest_road=busiest,
        peak_hour=peak_h,
        is_demo_data=True,
    )


def get_hourly_pattern(
    road_segment_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    period: Optional[str] = None,
) -> List[HourlyPattern]:
    """Compute hourly volume and speed averages."""
    data = load_traffic_data()
    road = get_road_by_id(road_segment_id) or ROAD_SEGMENTS[0]
    r_id = road["road_segment_id"]

    # Filter by road
    filtered = [d for d in data if d["road_segment_id"] == r_id]

    # Filter by date range if specified
    if start_date:
        filtered = [d for d in filtered if d["timestamp"][:10] >= start_date]
    if end_date:
        filtered = [d for d in filtered if d["timestamp"][:10] <= end_date]

    # Aggregate by hour
    by_hour: Dict[int, List[Dict]] = {h: [] for h in range(24)}
    for d in filtered:
        try:
            dt = datetime.fromisoformat(d["timestamp"])
            h = dt.hour
            by_hour[h].append(d)
        except Exception:
            pass

    patterns = []
    for h in range(24):
        group = by_hour[h]
        if group:
            avg_speed = sum(x["speed_kmh"] for x in group) / len(group)
            avg_vol = sum(x["volume"] for x in group) / len(group)
            avg_tt = sum(x["travel_time_seconds"] for x in group) / len(group)
        else:
            avg_speed = road["base_free_flow_speed"]
            avg_vol = 500
            avg_tt = (road["road_length_km"] / avg_speed) * 3600

        patterns.append(
            HourlyPattern(
                hour=h,
                avg_speed_kmh=round(avg_speed, 1),
                avg_volume=round(avg_vol, 1),
                avg_travel_time_seconds=round(avg_tt, 1),
            )
        )

    # Optional period filtering
    if period == "morning":
        patterns = [p for p in patterns if 6 <= p.hour <= 12]
    elif period == "afternoon":
        patterns = [p for p in patterns if 12 <= p.hour <= 17]
    elif period == "evening":
        patterns = [p for p in patterns if 17 <= p.hour <= 22]

    return patterns


def get_weekday_comparison(
    road_segment_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[WeekdayComparison]:
    """Compare weekday vs weekend traffic metrics."""
    data = load_traffic_data()
    road = get_road_by_id(road_segment_id) or ROAD_SEGMENTS[0]
    r_id = road["road_segment_id"]

    filtered = [d for d in data if d["road_segment_id"] == r_id]
    if start_date:
        filtered = [d for d in filtered if d["timestamp"][:10] >= start_date]
    if end_date:
        filtered = [d for d in filtered if d["timestamp"][:10] <= end_date]

    weekdays = []
    weekends = []

    for d in filtered:
        try:
            dt = datetime.fromisoformat(d["timestamp"])
            if dt.weekday() >= 5:
                weekends.append(d)
            else:
                weekdays.append(d)
        except Exception:
            pass

    def _avg(lst, key):
        return sum(x[key] for x in lst) / len(lst) if lst else 0.0

    return [
        WeekdayComparison(
            category="weekday",
            avg_speed_kmh=round(_avg(weekdays, "speed_kmh"), 1),
            avg_volume=round(_avg(weekdays, "volume"), 1),
            avg_travel_time_seconds=round(_avg(weekdays, "travel_time_seconds"), 1),
        ),
        WeekdayComparison(
            category="weekend",
            avg_speed_kmh=round(_avg(weekends, "speed_kmh"), 1),
            avg_volume=round(_avg(weekends, "volume"), 1),
            avg_travel_time_seconds=round(_avg(weekends, "travel_time_seconds"), 1),
        ),
    ]


def get_peak_hours(
    road_segment_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Tuple[List[int], List[int], List[PeakHourInfo]]:
    """Detect morning and evening peak traffic hours."""
    patterns = get_hourly_pattern(road_segment_id, start_date, end_date)

    morning_candidates = [p for p in patterns if 7 <= p.hour <= 11]
    evening_candidates = [p for p in patterns if 16 <= p.hour <= 21]

    # Sort candidates by volume descending
    m_sorted = sorted(morning_candidates, key=lambda x: x.avg_volume, reverse=True)
    e_sorted = sorted(evening_candidates, key=lambda x: x.avg_volume, reverse=True)

    morning_peaks = [m_sorted[0].hour, m_sorted[1].hour] if len(m_sorted) >= 2 else [9, 10]
    evening_peaks = [e_sorted[0].hour, e_sorted[1].hour] if len(e_sorted) >= 2 else [18, 19]

    hourly_details = [
        PeakHourInfo(
            hour=p.hour,
            avg_volume=p.avg_volume,
            avg_speed_kmh=p.avg_speed_kmh,
            is_morning_peak=(p.hour in morning_peaks),
            is_evening_peak=(p.hour in evening_peaks),
        )
        for p in patterns
    ]

    return morning_peaks, evening_peaks, hourly_details


def get_congestion_trends(
    road_segment_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[CongestionTrendPoint]:
    """Compute daily congestion trends."""
    data = load_traffic_data()
    filtered = data
    if road_segment_id:
        road = get_road_by_id(road_segment_id)
        if road:
            filtered = [d for d in filtered if d["road_segment_id"] == road["road_segment_id"]]

    if start_date:
        filtered = [d for d in filtered if d["timestamp"][:10] >= start_date]
    if end_date:
        filtered = [d for d in filtered if d["timestamp"][:10] <= end_date]

    by_date: Dict[str, List[Dict]] = {}
    for d in filtered:
        dt_str = d["timestamp"][:10]
        by_date.setdefault(dt_str, []).append(d)

    trends = []
    for dt_str in sorted(by_date.keys()):
        items = by_date[dt_str]
        avg_spd = sum(x["speed_kmh"] for x in items) / len(items)
        avg_vol = sum(x["volume"] for x in items) / len(items)
        # Baseline free flow speed ~ 50 km/h
        free_flow = 50.0
        # Congestion Index: ratio of free-flow speed to actual speed (>1 = congested)
        c_index = max(1.0, round(free_flow / max(avg_spd, 1.0), 2))

        trends.append(
            CongestionTrendPoint(
                date=dt_str,
                avg_speed_kmh=round(avg_spd, 1),
                avg_volume=round(avg_vol, 1),
                congestion_index=c_index,
            )
        )

    return trends
