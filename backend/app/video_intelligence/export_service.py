"""
Telemetry and Analytics Export Service.
Generates structured analysis datasets in standard formats:
1. Raw Trajectory CSV (Pixels, bboxes, frame index, timestamps)
2. Geospatial Trajectory CSV (Ground X/Y meters, WGS84 Lat/Lon, Speed km/h)
3. GeoJSON Trajectories (Vector LineString features for GIS mapping)
4. Traffic Statistics CSV (Time-binned volumes, densities, flow rates, occupancies)
5. Analysis Summary JSON (High-level project telemetry report)
"""
import os
import csv
import json
from typing import Dict, Any, List, Sequence
from pathlib import Path


def generate_raw_trajectory_csv(
    observations: Sequence[Dict[str, Any]],
    output_path: Path
) -> str:
    """Generate raw pixel trajectory CSV."""
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "track_id", "frame_idx", "timestamp_s", "vehicle_class",
            "confidence", "bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2",
            "image_centroid_x", "image_centroid_y"
        ])
        for obs in observations:
            bbox = obs.get("bbox", [0, 0, 0, 0])
            writer.writerow([
                obs.get("track_id"),
                obs.get("frame_idx"),
                obs.get("timestamp_s"),
                obs.get("vehicle_class"),
                obs.get("confidence"),
                bbox[0], bbox[1], bbox[2], bbox[3],
                obs.get("image_x"),
                obs.get("image_y"),
            ])
    return str(output_path)


def generate_geospatial_trajectory_csv(
    observations: Sequence[Dict[str, Any]],
    output_path: Path
) -> str:
    """Generate georeferenced metric trajectory CSV."""
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "track_id", "frame_idx", "timestamp_s", "vehicle_class",
            "ground_x_m", "ground_y_m", "latitude", "longitude",
            "speed_kmh", "direction"
        ])
        for obs in observations:
            writer.writerow([
                obs.get("track_id"),
                obs.get("frame_idx"),
                obs.get("timestamp_s"),
                obs.get("vehicle_class"),
                obs.get("ground_x_m", ""),
                obs.get("ground_y_m", ""),
                obs.get("latitude", ""),
                obs.get("longitude", ""),
                obs.get("speed_kmh", ""),
                obs.get("direction", ""),
            ])
    return str(output_path)


def generate_trajectories_geojson(
    observations: Sequence[Dict[str, Any]],
    output_path: Path
) -> str:
    """Group trajectory observations by track_id and export GeoJSON LineStrings."""
    tracks_coords: Dict[int, List[List[float]]] = {}
    tracks_metadata: Dict[int, Dict[str, Any]] = {}

    for obs in observations:
        lat = obs.get("latitude")
        lon = obs.get("longitude")
        if lat is not None and lon is not None:
            t_id = obs["track_id"]
            if t_id not in tracks_coords:
                tracks_coords[t_id] = []
                tracks_metadata[t_id] = {
                    "track_id": t_id,
                    "vehicle_class": obs.get("vehicle_class"),
                    "start_time_s": obs.get("timestamp_s"),
                    "speeds_kmh": [],
                }
            tracks_coords[t_id].append([lon, lat]) # GeoJSON uses [longitude, latitude]
            if obs.get("speed_kmh"):
                tracks_metadata[t_id]["speeds_kmh"].append(obs["speed_kmh"])

    features = []
    for t_id, coords in tracks_coords.items():
        if len(coords) >= 2:
            meta = tracks_metadata[t_id]
            speeds = meta.pop("speeds_kmh", [])
            avg_spd = round(sum(speeds) / len(speeds), 1) if speeds else None
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords,
                },
                "properties": {
                    **meta,
                    "avg_speed_kmh": avg_spd,
                    "points_count": len(coords),
                }
            }
            features.append(feature)

    geojson_doc = {
        "type": "FeatureCollection",
        "features": features,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson_doc, f, indent=2)

    return str(output_path)


def generate_traffic_stats_csv(
    measurements: Sequence[Dict[str, Any]],
    output_path: Path
) -> str:
    """Export time-interval aggregated traffic measurements to CSV."""
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "interval_start_s", "interval_end_s", "region_name",
            "vehicle_count", "unique_vehicle_count", "density_per_m2",
            "density_per_km2", "occupancy_percent", "avg_speed_kmh",
            "max_speed_kmh", "flow_rate_vph", "congestion_level"
        ])
        for m in measurements:
            writer.writerow([
                m.get("interval_start_s"),
                m.get("interval_end_s"),
                m.get("region_name", "Global"),
                m.get("vehicle_count"),
                m.get("unique_vehicle_count"),
                m.get("density_per_m2"),
                m.get("density_per_km2"),
                m.get("occupancy_percent"),
                m.get("avg_speed_kmh"),
                m.get("max_speed_kmh"),
                m.get("flow_rate_vph"),
                m.get("congestion_level"),
            ])
    return str(output_path)


def generate_analysis_summary_json(
    summary_data: Dict[str, Any],
    output_path: Path
) -> str:
    """Export comprehensive analysis summary report JSON."""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)
    return str(output_path)
