"""
Traffic Forecast & Historical Analytics API Endpoints.

Provides 24-hour forecasting, point predictions, peak hour detection,
weekday-vs-weekend comparisons, and congestion trend telemetry.
"""
from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException, status
from app.models.traffic import (
    RoadsListResponse,
    TrafficForecastResponse,
    TwentyFourHourForecastResponse,
    HourlyPatternResponse,
    WeekdayComparisonResponse,
    PeakHoursResponse,
    CongestionTrendsResponse,
    TrafficAnalyticsSummary,
    ModelInfoResponse,
)
from app.services.traffic_data import (
    get_road_segments_list,
    get_road_by_id,
    get_analytics_summary,
    get_hourly_pattern,
    get_weekday_comparison,
    get_peak_hours,
    get_congestion_trends,
    ROAD_SEGMENTS,
)
from app.services.prediction import (
    predict_traffic_point,
    get_24_hour_forecast,
    get_model_info,
)

router = APIRouter()


@router.get("/roads", response_model=RoadsListResponse)
def list_road_segments():
    """List all monitored road segments in the city network."""
    segments = get_road_segments_list()
    return RoadsListResponse(
        roads=segments,
        total=len(segments),
        data_source="SIMULATED DEMO DATA — Not real measurements",
        is_demo_data=True,
    )


@router.get("/forecast", response_model=TrafficForecastResponse)
def get_point_forecast(
    road_segment_id: str = Query(..., description="Road segment ID, e.g. 'RS-01'"),
    timestamp: str = Query(..., description="Target timestamp in ISO format"),
):
    """Get predicted travel time, speed, and volume for a specific road at a given time."""
    pred = predict_traffic_point(road_segment_id, timestamp)
    return TrafficForecastResponse(**pred)


@router.get("/24-hour", response_model=TwentyFourHourForecastResponse)
def get_daily_forecast(
    road_segment_id: Optional[str] = Query(None, description="Road segment ID"),
    road_id: Optional[str] = Query(None, description="Alternative parameter for road segment ID"),
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
):
    """Retrieve the complete 24-hour forecast profile for a road segment."""
    r_id = road_segment_id or road_id or "RS-01"
    return get_24_hour_forecast(r_id, date)


@router.get("/analytics/summary", response_model=TrafficAnalyticsSummary)
def get_traffic_summary():
    """Get high-level summary metrics across the historical traffic dataset."""
    return get_analytics_summary()


@router.get("/analytics/hourly-pattern", response_model=HourlyPatternResponse)
def get_hourly_analytics(
    road_segment_id: Optional[str] = Query(None),
    road_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    period: Optional[str] = Query(None, description="'morning', 'afternoon', 'evening', or None"),
):
    """Get average volume and speed patterns aggregated by hour of the day."""
    r_id = road_segment_id or road_id or "RS-01"
    road = get_road_by_id(r_id) or ROAD_SEGMENTS[0]
    patterns = get_hourly_pattern(r_id, start_date=start_date, end_date=end_date, period=period)

    return HourlyPatternResponse(
        road_segment_id=road["road_segment_id"],
        road_name=road["road_name"],
        patterns=patterns,
        data_source="SIMULATED DEMO DATA — Not real measurements",
        is_demo_data=True,
    )


@router.get("/analytics/weekday-comparison", response_model=WeekdayComparisonResponse)
def get_weekday_analytics(
    road_segment_id: Optional[str] = Query(None),
    road_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Compare average speed and traffic volume between weekdays and weekends."""
    r_id = road_segment_id or road_id or "RS-01"
    road = get_road_by_id(r_id) or ROAD_SEGMENTS[0]
    comp = get_weekday_comparison(r_id, start_date=start_date, end_date=end_date)

    return WeekdayComparisonResponse(
        road_segment_id=road["road_segment_id"],
        road_name=road["road_name"],
        comparison=comp,
        data_source="SIMULATED DEMO DATA — Not real measurements",
        is_demo_data=True,
    )


@router.get("/analytics/peak-hours", response_model=PeakHoursResponse)
def get_peak_hour_analytics(
    road_segment_id: Optional[str] = Query(None),
    road_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Detect morning and evening rush hour windows based on traffic density."""
    r_id = road_segment_id or road_id or "RS-01"
    road = get_road_by_id(r_id) or ROAD_SEGMENTS[0]
    m_peaks, e_peaks, details = get_peak_hours(r_id, start_date=start_date, end_date=end_date)

    return PeakHoursResponse(
        road_segment_id=road["road_segment_id"],
        road_name=road["road_name"],
        morning_peak_hours=m_peaks,
        evening_peak_hours=e_peaks,
        hourly_details=details,
        data_source="SIMULATED DEMO DATA — Not real measurements",
        is_demo_data=True,
    )


@router.get("/analytics/congestion-trends", response_model=CongestionTrendsResponse)
def get_congestion_trends_analytics(
    road_segment_id: Optional[str] = Query(None),
    road_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Retrieve historical daily congestion indices and speed degradation curves."""
    r_id = road_segment_id or road_id
    trends = get_congestion_trends(r_id, start_date=start_date, end_date=end_date)

    s_date = start_date or (trends[0].date if trends else "")
    e_date = end_date or (trends[-1].date if trends else "")

    return CongestionTrendsResponse(
        start_date=s_date,
        end_date=e_date,
        trends=trends,
        data_source="SIMULATED DEMO DATA — Not real measurements",
        is_demo_data=True,
    )


@router.get("/model-info", response_model=ModelInfoResponse)
def get_prediction_model_info():
    """Retrieve training and evaluation metrics of the traffic prediction model."""
    return get_model_info()
