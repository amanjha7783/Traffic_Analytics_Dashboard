import { VehicleTrack, CameraStream, IncidentAlert } from '../types';

export const VEHICLE_TRACKS: VehicleTrack[] = [
  {
    id: 'V-024',
    type: 'Car',
    classification: 'Passenger Car (Sedan)',
    speed: 34.2,
    confidence: 0.94,
    direction: 'West → North (Turn)',
    duration: 18.4,
    curvature: 0.12,
    homographyError: 0.24,
    collisionPotential: 'LOW',
    ttc: 0.18,
    dimensions: '4.6m x 1.9m',
    weightEst: '1.4t est',
    bbox: {
      left: '61%',
      top: '58%',
      width: '14%',
      height: '16%'
    },
    color: '#4cd7f6',
    statusText: 'Car • 34.2 km/h'
  },
  {
    id: 'V-018',
    type: 'Truck',
    classification: 'Commercial Box Truck',
    speed: 22.0,
    confidence: 0.89,
    direction: 'North → South (Straight)',
    duration: 24.1,
    curvature: 0.03,
    homographyError: 0.31,
    collisionPotential: 'MEDIUM',
    ttc: 1.12,
    dimensions: '8.2m x 2.4m',
    weightEst: '7.8t est',
    bbox: {
      left: '48%',
      top: '40%',
      width: '11%',
      height: '21%'
    },
    color: '#f59e0b',
    statusText: 'Truck • 22 km/h',
    decelerating: true
  },
  {
    id: 'V-012',
    type: 'Bus',
    classification: 'Transit Bus (Articulated)',
    speed: 19.0,
    confidence: 0.91,
    direction: 'East → West (Left Turn)',
    duration: 31.8,
    curvature: 0.19,
    homographyError: 0.18,
    collisionPotential: 'MEDIUM',
    ttc: 1.45,
    dimensions: '12.0m x 2.5m',
    weightEst: '14.2t est',
    bbox: {
      left: '68%',
      top: '46%',
      width: '13%',
      height: '18%'
    },
    color: '#adc6ff',
    statusText: 'Bus • 19 km/h'
  },
  {
    id: 'V-031',
    type: 'Moto',
    classification: 'Motorcycle / Scooter',
    speed: 41.0,
    confidence: 0.88,
    direction: 'South-West → East',
    duration: 9.6,
    curvature: 0.08,
    homographyError: 0.42,
    collisionPotential: 'HIGH',
    ttc: 0.92,
    dimensions: '2.1m x 0.8m',
    weightEst: '0.22t est',
    bbox: {
      left: '38%',
      top: '66%',
      width: '6%',
      height: '10%'
    },
    color: '#4edea3',
    statusText: 'Moto • 41 km/h'
  }
];

export const CAMERA_STREAMS: CameraStream[] = [
  {
    id: 'cam-01',
    name: 'Camera 01 • Junction 67 (Eastbound Quad)',
    junction: 'Junction 67',
    code: '#CV-882',
    rtspUrl: 'rtsp://edge.traffic.net:8554/cam01_east',
    resolution: '1920x1080',
    fps: 30.2,
    status: 'ONLINE',
    latencyMs: 24,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDS7P7zihm89OrTfEl0WtsiyJtWVmWwjSOoGmVai5g9edjD4oIQFfMlrPyRiMPit-gddYuPi6eIZYVgFPloEVq3I9F7rPvA53NMgju0fO-vlNI8I25U5lQDlR53EEkR_MtPua3MjAPtK8375o6KQN90tMB-58pYdNvDI4QO3kfu12H01XrFbf4jA13hTx-vHD3J37xD-KIzULHweROtBCL4zg--KLRiDmo7z9L4zdcS0-l2s7CHPBJ6'
  },
  {
    id: 'cam-02',
    name: 'Camera 02 • Junction 67 (North Approach Cross)',
    junction: 'Junction 67 North',
    code: '#CV-883',
    rtspUrl: 'rtsp://edge.traffic.net:8554/cam02_north',
    resolution: '1920x1080',
    fps: 29.8,
    status: 'ONLINE',
    latencyMs: 27,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIq9Dm5mNgnJA2JjZLcBFizdIiakSNdaUyC5YpMrBzs9Eze7oe1DBROljIbetJTiQM_72FKuSmh86aD0NFZpzsm2ST-jilOgjXfNTEJ4Wp65FYM9_FKa9-_b9OwiI2tkogrS6qQKsa6fcZjX-WEP7MIErO3YsofWQkLwk0H48ELom-S_SM3ARYveYRym_XOS3oyESMbDi5yc6oT1XSG3KB5nMh7qoxRLW1Evh3X8UTkIoUGMhPxCQp'
  },
  {
    id: 'cam-03',
    name: 'Camera 03 • Junction 68 (West Corridor)',
    junction: 'Junction 68 West',
    code: '#CV-884',
    rtspUrl: 'rtsp://edge.traffic.net:8554/cam03_west',
    resolution: '1920x1080',
    fps: 30.0,
    status: 'ONLINE',
    latencyMs: 22,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDS7P7zihm89OrTfEl0WtsiyJtWVmWwjSOoGmVai5g9edjD4oIQFfMlrPyRiMPit-gddYuPi6eIZYVgFPloEVq3I9F7rPvA53NMgju0fO-vlNI8I25U5lQDlR53EEkR_MtPua3MjAPtK8375o6KQN90tMB-58pYdNvDI4QO3kfu12H01XrFbf4jA13hTx-vHD3J37xD-KIzULHweROtBCL4zg--KLRiDmo7z9L4zdcS0-l2s7CHPBJ6'
  },
  {
    id: 'cam-04',
    name: 'Camera 04 • Shibuya Pedestrian Crosswalk',
    junction: 'Tokyo Shibuya',
    code: '#CV-910',
    rtspUrl: 'rtsp://edge.traffic.net:8554/cam04_shibuya',
    resolution: '2560x1440',
    fps: 30.1,
    status: 'ONLINE',
    latencyMs: 31,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIq9Dm5mNgnJA2JjZLcBFizdIiakSNdaUyC5YpMrBzs9Eze7oe1DBROljIbetJTiQM_72FKuSmh86aD0NFZpzsm2ST-jilOgjXfNTEJ4Wp65FYM9_FKa9-_b9OwiI2tkogrS6qQKsa6fcZjX-WEP7MIErO3YsofWQkLwk0H48ELom-S_SM3ARYveYRym_XOS3oyESMbDi5yc6oT1XSG3KB5nMh7qoxRLW1Evh3X8UTkIoUGMhPxCQp'
  }
];

export const INCIDENT_LOGS: IncidentAlert[] = [
  {
    id: 'INC-2041',
    timestamp: '10:41:08 UTC',
    location: 'Junction 67 - Center Cross',
    type: 'Near-Miss TTC',
    severity: 'CRITICAL',
    score: 88,
    primaryVehicles: ['V-024', 'V-018'],
    resolved: false
  },
  {
    id: 'INC-2039',
    timestamp: '10:38:22 UTC',
    location: 'Eastbound Turn Pocket',
    type: 'Queue Spillback',
    severity: 'ELEVATED',
    score: 64,
    primaryVehicles: ['V-012', 'V-008'],
    resolved: true
  },
  {
    id: 'INC-2035',
    timestamp: '10:29:45 UTC',
    location: 'North Transit Busway',
    type: 'Sudden Deceleration',
    severity: 'MODERATE',
    score: 52,
    primaryVehicles: ['V-018'],
    resolved: true
  },
  {
    id: 'INC-2028',
    timestamp: '10:14:10 UTC',
    location: 'Westbound Merge Lane',
    type: 'Wrong-Way Angle',
    severity: 'ELEVATED',
    score: 71,
    primaryVehicles: ['V-031'],
    resolved: true
  }
];
