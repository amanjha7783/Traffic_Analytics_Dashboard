import axios from 'axios';
import { API_ORIGIN } from './trafficApi';
import type { CameraStream } from '../types';

const API_URL = `${API_ORIGIN}/api`;

export interface VideoSession {
  session_id: string;
  status: string;
  video_name?: string;
  progress_percent: number;
  current_frame: number;
  total_frames: number;
  raw_frame_detections: number;
  confirmed_unique_tracks: number;
  counted_crossings: number;
  category_counts?: Record<string, number>;
  error_message?: string | null;
  summary?: {
    category_counts?: Record<string, number>;
    total_motor_vehicles?: number;
    total_vehicles_including_bicycle?: number;
    pedestrians?: number;
    speed_kmh?: number | null;
    speed_note?: string;
    data_source?: string;
    is_partial?: boolean;
    video_filename?: string;
  };
  minute_counts?: Array<Record<string, unknown>>;
  exports?: Record<string, string>;
}

export const fetchCameras = async (): Promise<CameraStream[]> => {
  const response = await axios.get(`${API_URL}/cameras`);
  return response.data.cameras;
};

export const startCamera = async (cameraId: string) => {
  const response = await axios.post(`${API_URL}/cameras/${encodeURIComponent(cameraId)}/start`);
  return response.data;
};

export const stopCamera = async (cameraId: string) => {
  await axios.post(`${API_URL}/cameras/${encodeURIComponent(cameraId)}/stop`);
};

export const fetchCameraMetrics = async (cameraId: string) => {
  const response = await axios.get(`${API_URL}/cameras/${encodeURIComponent(cameraId)}/metrics`);
  return response.data;
};

export const createCamera = async (configuration: Record<string, unknown>) => {
  const response = await axios.post(`${API_URL}/cameras`, configuration);
  return response.data;
};

export const createCorridor = async (configuration: Record<string, unknown>) => {
  const response = await axios.post(`${API_URL}/corridors`, configuration);
  return response.data;
};

export const fetchCorridors = async () => {
  const response = await axios.get(`${API_URL}/corridors`);
  return response.data.corridors;
};

export const fetchCorridor = async (corridorId: string) => {
  const response = await axios.get(`${API_URL}/corridors/${encodeURIComponent(corridorId)}`);
  return response.data;
};

export const saveCameraCalibration = async (
  corridorId: string,
  cameraId: string,
  imagePoints: number[][],
  groundPointsM: number[][],
) => {
  const response = await axios.post(
    `${API_URL}/corridors/${encodeURIComponent(corridorId)}/calibration`,
    { camera_id: cameraId, image_points: imagePoints, ground_points_m: groundPointsM },
  );
  return response.data;
};

export const uploadVideo = async (
  file: File,
  cameraId: string,
  confidenceThreshold: number,
  countingLine: [[number, number], [number, number]] | null,
): Promise<VideoSession> => {
  const form = new FormData();
  form.append('file', file);
  form.append('camera_id', cameraId || 'uploaded-video');
  form.append('confidence_threshold', String(confidenceThreshold));
  if (countingLine) form.append('counting_line', JSON.stringify(countingLine));
  const response = await axios.post(`${API_URL}/video-processing`, form);
  return response.data;
};

export const fetchVideoSession = async (sessionId: string): Promise<VideoSession> => {
  const response = await axios.get(`${API_URL}/video-processing/${encodeURIComponent(sessionId)}`);
  return response.data;
};

export const fetchLatestCompletedVideo = async (): Promise<VideoSession> => {
  const response = await axios.get(`${API_URL}/video-processing/latest`);
  return response.data;
};

export const controlVideoSession = async (
  sessionId: string,
  action: 'pause' | 'resume' | 'stop',
) => axios.post(`${API_URL}/video-processing/${encodeURIComponent(sessionId)}/${action}`);
