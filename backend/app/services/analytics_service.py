from app.services.trajectory_service import load_trajectory_data
from app.models.schemas import AnalyticsSummary
from collections import defaultdict

def calculate_summary() -> AnalyticsSummary:
    data = load_trajectory_data()
    if not data:
        return AnalyticsSummary(total_vehicles=0, average_speed=0.0, active_tracks=0, risk_level="Low", risk_score=0)
    
    unique_vehicles = set(p.vehicle_id for p in data)
    avg_speed = sum(p.speed for p in data) / len(data)
    
    # Very simple prototype risk score:
    # Based on average speed and number of vehicles
    risk_score = min(100, int((len(unique_vehicles) * 1.5) + (avg_speed * 0.5)))
    
    if risk_score > 70:
        risk_level = "High"
    elif risk_score > 30:
        risk_level = "Medium"
    else:
        risk_level = "Low"
        
    return AnalyticsSummary(
        total_vehicles=len(unique_vehicles),
        average_speed=round(avg_speed, 2),
        active_tracks=len(unique_vehicles), # simplified
        risk_level=risk_level,
        risk_score=risk_score
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
