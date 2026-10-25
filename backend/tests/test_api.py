"""
Automated Backend Tests for Traffic Analytics & Route Planning.
Tests endpoint validation, routing, geocoding fallback, and forecast APIs.
"""
import os
import sys
import pytest

# Ensure backend directory is in path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_existing_trajectories():
    res = client.get("/api/trajectories/")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_existing_analytics_summary():
    res = client.get("/api/analytics/summary")
    assert res.status_code == 200
    data = res.json()
    assert "total_vehicles" in data
    assert "average_speed" in data


def test_roads_list():
    res = client.get("/api/traffic/roads")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] > 0
    assert len(data["roads"]) > 0
    assert data["is_demo_data"] is True


def test_24_hour_forecast():
    res = client.get("/api/traffic/24-hour?road_segment_id=RS-01&date=2026-10-25")
    assert res.status_code == 200
    data = res.json()
    assert len(data["forecasts"]) == 24
    assert data["forecasts"][0]["hour"] == 0
    assert data["forecasts"][12]["predicted_speed_kmh"] > 0


def test_historical_analytics_endpoints():
    res_hourly = client.get("/api/traffic/analytics/hourly-pattern?road_segment_id=RS-01")
    assert res_hourly.status_code == 200
    assert len(res_hourly.json()["patterns"]) == 24

    res_weekday = client.get("/api/traffic/analytics/weekday-comparison?road_segment_id=RS-01")
    assert res_weekday.status_code == 200
    assert len(res_weekday.json()["comparison"]) == 2

    res_peaks = client.get("/api/traffic/analytics/peak-hours?road_segment_id=RS-01")
    assert res_peaks.status_code == 200
    assert "morning_peak_hours" in res_peaks.json()

    res_trends = client.get("/api/traffic/analytics/congestion-trends?road_segment_id=RS-01")
    assert res_trends.status_code == 200
    assert isinstance(res_trends.json()["trends"], list)


def test_model_info():
    res = client.get("/api/traffic/model-info")
    assert res.status_code == 200
    data = res.json()
    assert "model_type" in data
    assert "mae" in data


def test_route_estimate_validation():
    # Missing required fields
    res = client.post("/api/route/estimate", json={})
    assert res.status_code == 422


def test_route_estimate_invalid_location():
    # Nonsense location string that won't geocode
    res = client.post(
        "/api/route/estimate",
        json={
            "origin": "zzzzzzzz_unresolvable_spot_12345",
            "destination": "Charbagh Railway Station",
            "city": "Lucknow",
            "departure_time": "18:30",
            "mode": "baseline",
        },
    )
    assert res.status_code == 400
    assert "Could not resolve" in res.json()["detail"]
