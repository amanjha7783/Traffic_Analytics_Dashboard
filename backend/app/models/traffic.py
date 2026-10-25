"""
Pydantic models for Traffic Forecast and Historical Analytics endpoints.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime


class RoadSegment(BaseModel):
    """A road segment definition."""
    road_segment_id: str
    road_name: str
    road_length_km: float
    num_lanes: int
    speed_limit_kmh: float


class TrafficRecord(BaseModel):
    """A single historical traffic record."""
    timestamp: str
    road_segment_id: str
    road_name: str
    speed_kmh: float
    volume: int
    travel_time_seconds: float
    road_length_km: float
    num_lanes: int
    speed_limit_kmh: float


class TrafficForecastRequest(BaseModel):
    """Query parameters for a traffic forecast."""
    road_segment_id: str
    timestamp: str = Field(
        ..., description="ISO-format timestamp for prediction, e.g. 2024-03-15T08:30:00"
    )


class TrafficForecastResponse(BaseModel):
    """Response for a point traffic forecast."""
    road_segment_id: str
    road_name: str
    timestamp: str
    predicted_travel_time_seconds: float
    predicted_speed_kmh: float
    predicted_volume: int
    confidence_note: str = "Prediction from XGBoost model trained on SIMULATED DEMO DATA"
    data_source: str = "SIMULATED DEMO DATA — Not real measurements"
    is_demo_data: bool = True


class HourlyForecast(BaseModel):
    """A single hour's forecast in a 24-hour series."""
    hour: int
    timestamp: str
    predicted_travel_time_seconds: float
    predicted_speed_kmh: float
    predicted_volume: int


class TwentyFourHourForecastResponse(BaseModel):
    """Response for a 24-hour forecast series."""
    road_segment_id: str
    road_name: str
    date: str
    forecasts: List[HourlyForecast]
    data_source: str = "SIMULATED DEMO DATA — Not real measurements"
    is_demo_data: bool = True


class HistoricalDataResponse(BaseModel):
    """Response for historical traffic data queries."""
    road_segment_id: str
    road_name: str
    start_date: str
    end_date: str
    records: List[TrafficRecord]
    total_records: int
    data_source: str = "SIMULATED DEMO DATA — Not real measurements"
    is_demo_data: bool = True


class RoadsListResponse(BaseModel):
    """Response listing available road segments."""
    roads: List[RoadSegment]
    total: int
    data_source: str = "SIMULATED DEMO DATA — Not real measurements"
    is_demo_data: bool = True


class TrafficAnalyticsSummary(BaseModel):
    """Summary analytics for historical traffic data."""
    total_records: int
    date_range: Dict[str, str]
    road_segments_count: int
    average_speed_kmh: float
    average_travel_time_seconds: float
    average_volume: int
    busiest_road: str
    peak_hour: int
    data_source: str = "SIMULATED DEMO DATA — Not real measurements"
    is_demo_data: bool = True


class HourlyPattern(BaseModel):
    """A single hour's average traffic pattern."""
    hour: int
    avg_speed_kmh: float
    avg_volume: float
    avg_travel_time_seconds: float


class HourlyPatternResponse(BaseModel):
    """Response for hourly traffic patterns."""
    road_segment_id: str
    road_name: str
    patterns: List[HourlyPattern]
    data_source: str = "SIMULATED DEMO DATA — Not real measurements"
    is_demo_data: bool = True


class WeekdayComparison(BaseModel):
    """Comparison between weekday and weekend traffic."""
    category: str  # "weekday" or "weekend"
    avg_speed_kmh: float
    avg_volume: float
    avg_travel_time_seconds: float


class WeekdayComparisonResponse(BaseModel):
    """Response for weekday vs weekend comparison."""
    road_segment_id: str
    road_name: str
    comparison: List[WeekdayComparison]
    data_source: str = "SIMULATED DEMO DATA — Not real measurements"
    is_demo_data: bool = True


class PeakHourInfo(BaseModel):
    """Peak hour detection result."""
    hour: int
    avg_volume: float
    avg_speed_kmh: float
    is_morning_peak: bool
    is_evening_peak: bool


class PeakHoursResponse(BaseModel):
    """Response for peak hour detection."""
    road_segment_id: str
    road_name: str
    morning_peak_hours: List[int]
    evening_peak_hours: List[int]
    hourly_details: List[PeakHourInfo]
    data_source: str = "SIMULATED DEMO DATA — Not real measurements"
    is_demo_data: bool = True


class CongestionTrendPoint(BaseModel):
    """A single point in congestion trend data."""
    date: str
    avg_speed_kmh: float
    avg_volume: float
    congestion_index: float = Field(
        ..., description="Congestion index: ratio of free-flow speed to actual speed (>1 = congested)"
    )


class CongestionTrendsResponse(BaseModel):
    """Response for congestion trends over time."""
    start_date: str
    end_date: str
    trends: List[CongestionTrendPoint]
    data_source: str = "SIMULATED DEMO DATA — Not real measurements"
    is_demo_data: bool = True


class ModelInfoResponse(BaseModel):
    """Response with model training info."""
    model_type: str
    features_used: List[str]
    training_records: int
    mae: float
    rmse: float
    r2_score: float
    training_date: str
    note: str = "Model trained on SIMULATED DEMO DATA. Metrics reflect demo data performance only."
