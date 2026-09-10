export type NavTab = 
  | 'overview' 
  | 'traffic-monitor' 
  | 'trajectories' 
  | 'risk-heatmap' 
  | 'analytics' 
  | 'reports';

export interface VehicleTrack {
  id: string;
  type: 'Car' | 'Truck' | 'Bus' | 'Moto';
  classification: string;
  speed: number; // km/h
  confidence: number;
  direction: string;
  duration: number; // seconds
  curvature: number; // rad/m
  homographyError: number; // meters
  collisionPotential: 'LOW' | 'MEDIUM' | 'HIGH';
  ttc: number; // seconds to collision
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
