export type NavTab = 
  | 'overview' 
  | 'traffic-monitor' 
  | 'trajectories' 
  | 'risk-heatmap' 
  | 'analytics' 
  | 'reports'
  | 'route-planner'
  | 'historical-analytics'
  | 'traffic-forecast';

// Geocoded Location
export interface GeocodedLocation {
  name: string;
  display_name: string;
  latitude: float;
  longitude: float;
  data_source: string;
}

// Route Step (Maneuver)
export interface RouteStep {
  instruction: string;
  distance_m: number;
  duration_s: number;
}

// Route Alternative
export interface RouteAlternative {
  geometry_polyline: string;
  geometry_coordinates: [number, number][]; // [lon, lat]
  distance_km: number;
  duration_minutes: number;
  summary: string;
  steps: RouteStep[];
}

// Route Estimate Request
export interface RouteRequest {
  origin: string;
  destination: string;
  city: string;
  departure_date?: string;
  departure_time?: string;
  mode: 'baseline' | 'traffic_aware';
}

// Route Estimate Response from Backend
export interface RouteEstimateResponse {
  origin: GeocodedLocation;
  destination: GeocodedLocation;
  routes: RouteAlternative[];
  best_route_index: number;
  departure_time?: string;
  estimated_arrival_time?: string;
  data_source: string;
  is_demo_data: boolean;
  traffic_aware_note?: string;
}

// Traffic Road Segment
export interface RoadSegment {
  road_segment_id: string;
  road_name: string;
  road_length_km: number;
  num_lanes: number;
  speed_limit_kmh: number;
}

export interface RoadsListResponse {
  roads: RoadSegment[];
  total: number;
  data_source: string;
  is_demo_data: boolean;
}

// Hourly Pattern
export interface HourlyPattern {
  hour: number;
  avg_speed_kmh: number;
  avg_volume: number;
  avg_travel_time_seconds: number;
}

export interface HourlyPatternResponse {
  road_segment_id: string;
  road_name: string;
  patterns: HourlyPattern[];
  data_source: string;
  is_demo_data: boolean;
}

// Weekday Comparison
export interface WeekdayComparison {
  category: 'weekday' | 'weekend';
  avg_speed_kmh: number;
  avg_volume: number;
  avg_travel_time_seconds: number;
}

export interface WeekdayComparisonResponse {
  road_segment_id: string;
  road_name: string;
  comparison: WeekdayComparison[];
  data_source: string;
  is_demo_data: boolean;
}

// Peak Hour
export interface PeakHourInfo {
  hour: number;
  avg_volume: number;
  avg_speed_kmh: number;
  is_morning_peak: boolean;
  is_evening_peak: boolean;
}

export interface PeakHoursResponse {
  road_segment_id: string;
  road_name: string;
  morning_peak_hours: number[];
  evening_peak_hours: number[];
  hourly_details: PeakHourInfo[];
  data_source: string;
  is_demo_data: boolean;
}

// Congestion Trend
export interface CongestionTrendPoint {
  date: string;
  avg_speed_kmh: number;
  avg_volume: number;
  congestion_index: number;
}

export interface CongestionTrendsResponse {
  start_date: string;
  end_date: string;
  trends: CongestionTrendPoint[];
  data_source: string;
  is_demo_data: boolean;
}

// Summary
export interface TrafficAnalyticsSummary {
  total_records: number;
  date_range: { start: string; end: string };
  road_segments_count: number;
  average_speed_kmh: number;
  average_travel_time_seconds: number;
  average_volume: number;
  busiest_road: string;
  peak_hour: number;
  data_source: string;
  is_demo_data: boolean;
}

// 24-Hour Forecast
export interface HourlyForecast {
  hour: number;
  timestamp: string;
  predicted_travel_time_seconds: number;
  predicted_speed_kmh: number;
  predicted_volume: number;
}

export interface TwentyFourHourForecastResponse {
  road_segment_id: string;
  road_name: string;
  date: string;
  forecasts: HourlyForecast[];
  data_source: string;
  is_demo_data: boolean;
}

// Model Telemetry
export interface ModelInfoResponse {
  model_type: string;
  features_used: string[];
  training_records: number;
  mae: number;
  rmse: number;
  r2_score: number;
  training_date: string;
  note: string;
}

// Existing Types
export interface VehicleTrack {
  id: string;
  type: 'Car' | 'Truck' | 'Bus' | 'Moto';
  classification: string;
  speed: number;
  confidence: number;
  direction: string;
  duration: number;
  curvature: number;
  homographyError: number;
  collisionPotential: 'LOW' | 'MEDIUM' | 'HIGH';
  ttc: number;
  dimensions: string;
  weightEst: string;
  bbox: {
    left: string;
    top: string;
    width: string;
    height: string;
  };
  color: string;
  statusText?: string;
  decelerating?: boolean;
}

export interface CameraStream {
  id: string;
  name: string;
  junction: string;
  code: string;
  rtspUrl: string;
  resolution: string;
  fps: number;
  status: 'ONLINE' | 'STANDBY' | 'CALIBRATING';
  latencyMs: number;
  imageUrl: string;
}

export interface IncidentAlert {
  id: string;
  timestamp: string;
  location: string;
  type: 'Near-Miss TTC' | 'Queue Spillback' | 'Sudden Deceleration' | 'Wrong-Way Angle';
  severity: 'CRITICAL' | 'ELEVATED' | 'MODERATE';
  score: number;
  primaryVehicles: string[];
  resolved: boolean;
}
