/**
 * TypeScript Type Definitions for Video Intelligence Studio.
 * Models projects, multi-camera video sources, ground-control points,
 * homography calibration, measurement regions, processing jobs,
 * trajectory telemetry, density measurements, and comparative analytics.
 */

export interface StudioProject {
  id: string;
  name: string;
  description: string;
  location: string;
  city: string;
  state: string;
  country: string;
  road_name: string;
  latitude: number;
  longitude: number;
  crs: string;
  status: 'ACTIVE' | 'ARCHIVED' | string;
  created_at: string;
  updated_at: string;
  video_count: number;
  analyzed_count: number;
}

export interface StudioVideo {
  id: string;
  camera_id: string;
  title: string;
  original_filename: string;
  duration_seconds: number;
  fps: number;
  width: number;
  height: number;
  frame_count: number;
  file_size_bytes: number;
  status: 'READY' | 'PROCESSING' | 'analyzed' | 'UPLOADED' | string;
  created_at: string;
  is_calibrated: boolean;
  calibration_quality?: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'HIGH_RESIDUAL' | 'UNCALIBRATED' | string;
  reprojection_rmse_m?: number | null;
  analysis_summary?: VideoAnalysisSummary | null;
  has_annotated_video?: boolean;
}

export interface VideoAnalysisSummary {
  project_id?: string;
  video_id?: string;
  total_vehicles_detected?: number;
  total_trajectory_points?: number;
  vehicle_class_distribution?: Record<string, number>;
  avg_speed_kmh?: number;
  max_speed_kmh?: number;
  processed_frames?: number;
  video_fps?: number;
  calibrated?: boolean;
  annotated_video_available?: boolean;
  unique_vehicles?: number;
}

export interface GCPPoint {
  id: string;
  image_x: number;
  image_y: number;
  latitude: number;
  longitude: number;
  ground_x?: number | null;
  ground_y?: number | null;
}

export interface CalibrationData {
  id?: string;
  video_id: string;
  project_id?: string;
  is_calibrated: boolean;
  gcps: GCPPoint[];
  homography_matrix: number[][] | null;
  reprojection_rmse_m: number | null;
  calibration_quality: string;
  calibrated_at?: string;
}

export interface MeasurementRegion {
  id: string;
  video_id: string;
  project_id: string;
  name: string;
  region_type: 'ROAD_SURFACE' | 'LANE' | 'INTERSECTION' | 'MONITORING_ZONE' | 'VIRTUAL_GATE' | string;
  vertices_pixel: [number, number][];
  area_sqm: number | null;
  perimeter_m: number | null;
  road_width_m: number | null;
  color_hex?: string;
  created_at: string;
}

export interface ProcessingJob {
  id: string;
  video_id: string;
  video_title?: string;
  project_id: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress_percent: number;
  current_frame: number;
  total_frames: number;
  processing_fps: number;
  eta_seconds?: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeSeriesMeasurement {
  timestamp_s: number;
  vehicle_count: number;
  active_vehicles?: number;
  cumulative_unique_vehicles?: number;
  density_veh_sqm: number | null;
  density_veh_sqkm?: number | null;
  road_occupancy_percent?: number | null;
  avg_speed_kmh: number | null;
  has_valid_speed?: boolean;
  level_of_service?: string;
}

export interface VehicleTrackItem {
  id: string;
  track_id: number;
  vehicle_class: string;
  first_detected_s: number;
  last_detected_s: number;
  duration_s: number;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  total_distance_m?: number | null;
}

export interface DensityStats {
  avg_density_veh_sqkm: number;
  max_density_veh_sqkm: number;
  avg_occupancy_percent: number;
  max_occupancy_percent: number;
  road_area_sqm: number;
  road_perimeter_m?: number | null;
  road_width_m?: number | null;
  region_name?: string | null;
  calibration_status?: string;
  methodology?: string;
}

export interface VideoAnalyticsResponse {
  video_id: string;
  has_calibration?: boolean;
  has_road_area?: boolean;
  road_area_sqm?: number | null;
  density_stats?: DensityStats | null;
  summary: VideoAnalysisSummary;
  timeline: TimeSeriesMeasurement[];
}


export interface CameraComparisonItem {
  video_id: string;
  camera_id: string;
  title: string;
  duration_seconds: number;
  fps: number;
  rmse_m?: number | null;
  summary: VideoAnalysisSummary;
  timeline: {
    timestamp_s: number;
    vehicle_count: number;
    avg_speed_kmh: number;
    occupancy_percent: number;
  }[];
}

export interface ExportArtifact {
  id: string;
  export_type: string;
  filename: string;
  file_size_bytes: number;
  created_at: string;
}

export interface TrajectoryPointItem {
  id: number;
  track_id: number;
  frame_idx: number;
  timestamp_s: number;
  vehicle_class: string;
  confidence?: number;
  bbox?: [number, number, number, number];
  image_x: number;
  image_y: number;
  ground_x_m: number | null;
  ground_y_m: number | null;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
}

