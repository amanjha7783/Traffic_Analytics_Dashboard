import json
import random
import math

def generate_trajectories(num_vehicles=10, frames=100, fps=25):
    data = []
    types = ["car", "car", "car", "bus", "motorcycle", "truck"]
    
    for v_id in range(1, num_vehicles + 1):
        v_type = random.choice(types)
        
        # Random start position
        start_x = random.uniform(50, 400)
        start_y = random.uniform(50, 400)
        
        # Random direction (angle)
        angle = random.uniform(0, 2 * math.pi)
        speed = random.uniform(20, 60) # km/h
        speed_pixels_per_frame = speed * 0.1
        
        x, y = start_x, start_y
        for frame in range(1, frames + 1):
            timestamp = frame / fps
            
            # small random change in direction
            angle += random.uniform(-0.1, 0.1)
            x += speed_pixels_per_frame * math.cos(angle)
            y += speed_pixels_per_frame * math.sin(angle)
            
            # varying speed slightly
            speed += random.uniform(-1, 1)
            speed = max(10, min(80, speed))
            
            data.append({
                "vehicle_id": v_id,
                "frame": frame,
                "timestamp": round(timestamp, 2),
                "x": round(x, 2),
                "y": round(y, 2),
                "speed": round(speed, 2),
                "vehicle_type": v_type
            })
            
    return data

if __name__ == "__main__":
    trajectories = generate_trajectories(num_vehicles=30, frames=200)
    with open("data/trajectory_data.json", "w") as f:
        json.dump(trajectories, f, indent=2)
    print("Generated demo trajectory data.")
