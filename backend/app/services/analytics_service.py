from app.services.trajectory_service import load_trajectory_data
from app.models.schemas import AnalyticsSummary
from collections import defaultdict

def calculate_summary() -> AnalyticsSummary:
    data = load_trajectory_data()
    if not data:
        return AnalyticsSummary(
            total_vehicles=0,
            average_speed=0.0,
            data_source="HISTORICAL TRAJECTORY FILE; no live camera data",
            is_demo_data=True,
        )
    
    unique_vehicles = set(p.vehicle_id for p in data)
    avg_speed = sum(p.speed for p in data) / len(data)
    
    return AnalyticsSummary(
        total_vehicles=len(unique_vehicles),
        average_speed=round(avg_speed, 2),
        data_source="HISTORICAL TRAJECTORY FILE; not live CCTV telemetry",
        is_demo_data=True,
    )

def calculate_vehicles_over_time():
    data = load_trajectory_data()
    counts = defaultdict(set)
    for p in data:
        # group by integer timestamp for simplicity
        t = int(p.timestamp)
        counts[t].add(p.vehicle_id)
        
    result = [{"timestamp": t, "count": len(v_ids)} for t, v_ids in sorted(counts.items())]
    return result
