/**
 * Video Intelligence Studio API Client.
 * Communicates with FastAPI backend endpoints under /api/video-intelligence.
 */
import axios from 'axios';
import {
  StudioProject,
  StudioVideo,
  CalibrationData,
  GCPPoint,
  MeasurementRegion,
  ProcessingJob,
  VideoAnalyticsResponse,
  VehicleTrackItem,
  CameraComparisonItem,
  ExportArtifact,
} from '../types/videoIntelligence';

const API_BASE = 'http://127.0.0.1:8000/api/video-intelligence';

// Projects
export async function fetchProjects(): Promise<{ projects: StudioProject[]; total: number }> {
  const res = await axios.get(`${API_BASE}/projects`);
  return res.data;
}

export async function createProject(data: Partial<StudioProject>): Promise<{ project_id: string; message: string }> {
  const res = await axios.post(`${API_BASE}/projects`, data);
  return res.data;
}

export async function fetchProjectDetails(projectId: string): Promise<StudioProject & { videos: StudioVideo[] }> {
  const res = await axios.get(`${API_BASE}/projects/${projectId}`);
  return res.data;
}

export async function deleteProject(projectId: string): Promise<{ message: string }> {
  const res = await axios.delete(`${API_BASE}/projects/${projectId}`);
  return res.data;
}

// Videos
export async function uploadVideo(
  projectId: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<{ video: any; message: string }> {
  const res = await axios.post(`${API_BASE}/projects/${projectId}/videos/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (evt.total && onProgress) {
        onProgress(Math.round((evt.loaded * 100) / evt.total));
      }
    },
  });
  return res.data;
}

export async function fetchProjectVideos(projectId: string): Promise<{ videos: StudioVideo[]; total: number }> {
  const res = await axios.get(`${API_BASE}/projects/${projectId}/videos`);
  return res.data;
}

export async function fetchVideoDetails(videoId: string): Promise<StudioVideo> {
  const res = await axios.get(`${API_BASE}/videos/${videoId}`);
  return res.data;
}

export async function updateVideoName(videoId: string, name: string): Promise<{ id: string; name: string; message: string }> {
  const res = await axios.patch(`${API_BASE}/videos/${videoId}`, { name });
  return res.data;
}

export async function deleteVideo(videoId: string): Promise<{ message: string }> {
  const res = await axios.delete(`${API_BASE}/videos/${videoId}`);
  return res.data;
}

// Stream and Asset URLs
export function getVideoStreamUrl(videoId: string): string {
  return `${API_BASE}/videos/${videoId}/stream`;
}

export function getAnnotatedVideoStreamUrl(videoId: string): string {
  return `${API_BASE}/videos/${videoId}/annotated-stream`;
}

export function getFirstFrameUrl(videoId: string): string {
  return `${API_BASE}/videos/${videoId}/first-frame`;
}

export function getThumbnailUrl(videoId: string): string {
  return `${API_BASE}/videos/${videoId}/thumbnail`;
}

export function getExportDownloadUrl(exportId: string): string {
  return `${API_BASE}/exports/${exportId}/download`;
}

// Calibration
export async function fetchCalibration(videoId: string): Promise<CalibrationData> {
  const res = await axios.get(`${API_BASE}/videos/${videoId}/calibration`);
  return res.data;
}

export async function saveCalibration(
  videoId: string,
  gcps: GCPPoint[]
): Promise<CalibrationData & { message: string }> {
  const res = await axios.post(`${API_BASE}/videos/${videoId}/calibration`, { gcps });
  return res.data;
}

// Regions
export async function fetchRegions(videoId: string): Promise<{ regions: MeasurementRegion[]; total: number }> {
  const res = await axios.get(`${API_BASE}/videos/${videoId}/regions`);
  return res.data;
}

export async function createRegion(
  videoId: string,
  data: { name: string; region_type: string; vertices_pixel: [number, number][]; color_hex?: string }
): Promise<{ region_id: string; area_sqm: number; perimeter_m: number; road_width_m: number; message: string }> {
  const res = await axios.post(`${API_BASE}/videos/${videoId}/regions`, data);
  return res.data;
}

export async function previewRegion(
  videoId: string,
  vertices_pixel: [number, number][]
): Promise<{
  area_m2: number | null;
  perimeter_m: number | null;
  road_width_m: number | null;
  vertices_ground: [number, number][];
  calibrated: boolean;
  is_valid: boolean;
  error?: string;
  note?: string;
}> {
  const res = await axios.post(`${API_BASE}/videos/${videoId}/regions/preview`, { vertices_pixel });
  return res.data;
}

export async function deleteRegion(regionId: string): Promise<{ message: string }> {

  const res = await axios.delete(`${API_BASE}/regions/${regionId}`);
  return res.data;
}

// Processing Jobs
export async function startProcessingJob(
  videoId: string,
  config: {
    confidence_threshold?: number;
    iou_threshold?: number;
    frame_step?: number;
    max_frames?: number | null;
    generate_annotated_video?: boolean;
  }
): Promise<{ job_id: string; video_id: string; project_id: string; status: string }> {
  const res = await axios.post(`${API_BASE}/videos/${videoId}/process`, config);
  return res.data;
}

export async function fetchJobStatus(jobId: string): Promise<ProcessingJob> {
  const res = await axios.get(`${API_BASE}/jobs/${jobId}`);
  return res.data;
}

export async function pauseJob(jobId: string): Promise<{ success: boolean; status: string }> {
  const res = await axios.post(`${API_BASE}/jobs/${jobId}/pause`);
  return res.data;
}

export async function resumeJob(jobId: string): Promise<{ success: boolean; status: string }> {
  const res = await axios.post(`${API_BASE}/jobs/${jobId}/resume`);
  return res.data;
}

export async function cancelJob(jobId: string): Promise<{ success: boolean; status: string }> {
  const res = await axios.post(`${API_BASE}/jobs/${jobId}/cancel`);
  return res.data;
}

export async function fetchProjectJobs(projectId: string): Promise<{ jobs: ProcessingJob[] }> {
  const res = await axios.get(`${API_BASE}/projects/${projectId}/jobs`);
  return res.data;
}

// Video Analytics & Telemetry
export async function fetchVideoAnalytics(videoId: string): Promise<VideoAnalyticsResponse> {
  const res = await axios.get(`${API_BASE}/videos/${videoId}/analytics`);
  return res.data;
}

export async function fetchTrajectories(
  videoId: string,
  params?: { limit?: number; offset?: number; vehicle_class?: string; track_id?: number }
): Promise<{ tracks: VehicleTrackItem[]; total_tracks: number; limit: number; offset: number }> {
  const res = await axios.get(`${API_BASE}/videos/${videoId}/trajectories`, { params });
  return res.data;
}

export async function fetchHeatmaps(
  videoId: string,
  gridSize: number = 30
): Promise<{ video_id: string; grid_size: number; matrix: number[][] }> {
  const res = await axios.get(`${API_BASE}/videos/${videoId}/heatmaps`, { params: { grid_size: gridSize } });
  return res.data;
}

// Multi-Camera Comparison
export async function compareCameras(
  projectId: string,
  videoIds: string[]
): Promise<{ project_id: string; cameras: CameraComparisonItem[] }> {
  const res = await axios.get(`${API_BASE}/projects/${projectId}/compare`, {
    params: { video_ids: videoIds.join(',') },
  });
  return res.data;
}

// Exports
export async function fetchExports(videoId: string): Promise<{ exports: ExportArtifact[] }> {
  const res = await axios.get(`${API_BASE}/videos/${videoId}/exports`);
  return res.data;
}

// DataFromSky Import
export async function importDataFromSky(
  projectId: string,
  videoId: string,
  file: File
): Promise<{ summary: any; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axios.post(`${API_BASE}/projects/${projectId}/videos/${videoId}/import-datafromsky`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export function getTrajectoriesCsvUrl(videoId: string): string {
  return `${API_BASE}/videos/${videoId}/trajectories/csv`;
}

export function getObservationFrameUrl(observationId: number): string {
  return `${API_BASE}/observations/${observationId}/frame`;
}

export async function fetchObservationDetails(
  observationId: number
): Promise<import('../types/videoIntelligence').TrajectoryPointItem> {
  const res = await axios.get(`${API_BASE}/observations/${observationId}`);
  return res.data;
}

export async function fetchTrajectoryPoints(
  videoId: string,
  params?: { limit?: number; offset?: number; track_id?: number; vehicle_class?: string }
): Promise<{ points: import('../types/videoIntelligence').TrajectoryPointItem[]; total: number; limit: number; offset: number }> {
  const res = await axios.get(`${API_BASE}/videos/${videoId}/trajectory-points`, { params });
  return res.data;
}

