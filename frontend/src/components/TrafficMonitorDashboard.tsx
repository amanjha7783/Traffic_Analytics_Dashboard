import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CameraStream } from '../types';
import { API_ORIGIN } from '../services/trafficApi';
import {
  controlVideoSession,
  createCamera,
  createCorridor,
  fetchCameraMetrics,
  fetchCorridor,
  fetchCameras,
  fetchCorridors,
  fetchVideoSession,
  startCamera,
  saveCameraCalibration,
  stopCamera,
  uploadVideo,
  type VideoSession,
} from '../services/videoApi';

type VideoSummary = {
  category_counts?: Record<string, number>;
  total_motor_vehicles?: number;
  total_vehicles_including_bicycle?: number;
  counted_crossings?: number;
  data_source?: string;
  is_partial?: boolean;
  speed_note?: string;
};

const terminalStates = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'STOPPED']);

function errorText(error: unknown): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return error instanceof Error ? error.message : 'Request failed.';
}

export const TrafficMonitorDashboard: React.FC = () => {
  const [cameras, setCameras] = useState<CameraStream[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [cameraMetrics, setCameraMetrics] = useState<Record<string, Record<string, unknown>>>({});
  const [corridors, setCorridors] = useState<Record<string, unknown>[]>([]);
  const [selectedCorridorId, setSelectedCorridorId] = useState('');
  const [corridorDetail, setCorridorDetail] = useState<Record<string, unknown> | null>(null);
  const [calibrationCameraId, setCalibrationCameraId] = useState('');
  const [imagePointsText, setImagePointsText] = useState('');
  const [groundPointsText, setGroundPointsText] = useState('');
  const [notice, setNotice] = useState('');
  const [busyCameraId, setBusyCameraId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<[number, number] | null>(null);
  const [countingLine, setCountingLine] = useState<[number, number][]>([]);
  const [confidence, setConfidence] = useState(0.35);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('trafficVideoSessionId') || '');
  const [session, setSession] = useState<VideoSession | null>(null);
  const [cameraForm, setCameraForm] = useState({
    id: '', name: '', junction: '', code: '', video_source: 'rtsp',
    file_path: '', latitude: '', longitude: '', direction: '',
  });
  const [corridorForm, setCorridorForm] = useState({
    name: '', camera_a_id: '', camera_b_id: '', road_width_m: '', num_lanes: '',
    speed_limit_kmh: '', direction: '',
  });
  const previewRef = useRef<HTMLVideoElement>(null);

  const refreshCameras = async () => {
    const values = await fetchCameras();
    setCameras(values);
    setSelectedCameraId((current) => current || values[0]?.id || '');
  };

  useEffect(() => {
    Promise.all([refreshCameras(), fetchCorridors().then(setCorridors)])
      .catch((error: unknown) => setNotice(errorText(error)));
  }, []);

  useEffect(() => {
    if (!selectedCorridorId) return;
    fetchCorridor(selectedCorridorId)
      .then(setCorridorDetail)
      .catch((error: unknown) => setNotice(errorText(error)));
  }, [selectedCorridorId]);

  useEffect(() => {
    const poll = async () => {
      if (cameras.length === 0) return;
      const results = await Promise.allSettled(cameras.map((camera) => fetchCameraMetrics(camera.id)));
      setCameraMetrics((current) => {
        const next = { ...current };
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') next[cameras[index].id] = result.value;
        });
        return next;
      });
    };
    void poll();
    const timer = window.setInterval(poll, 3000);
    return () => window.clearInterval(timer);
  }, [cameras]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    const poll = async () => {
      try {
        const result = await fetchVideoSession(sessionId);
        if (active) setSession(result);
      } catch (error) {
        if (active) setNotice(errorText(error));
      }
    };
    void poll();
    const timer = window.setInterval(poll, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : '', [file]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const refreshAfterCameraAction = async (cameraId: string, start: boolean) => {
    setBusyCameraId(cameraId);
    setNotice('');
    try {
      if (start) await startCamera(cameraId);
      else await stopCamera(cameraId);
      await refreshCameras();
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusyCameraId('');
    }
  };

  const submitCamera = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice('');
    try {
      await createCamera({
        ...cameraForm,
        latitude: cameraForm.latitude ? Number(cameraForm.latitude) : null,
        longitude: cameraForm.longitude ? Number(cameraForm.longitude) : null,
        file_path: cameraForm.file_path || null,
      });
      setCameraForm({
        id: '', name: '', junction: '', code: '', video_source: 'rtsp',
        file_path: '', latitude: '', longitude: '', direction: '',
      });
      await refreshCameras();
      setNotice('Camera configuration saved. RTSP credentials are read from backend environment.');
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const submitCorridor = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice('');
    try {
      const created = await createCorridor({
        ...corridorForm,
        road_width_m: corridorForm.road_width_m ? Number(corridorForm.road_width_m) : null,
        num_lanes: corridorForm.num_lanes ? Number(corridorForm.num_lanes) : null,
        speed_limit_kmh: corridorForm.speed_limit_kmh ? Number(corridorForm.speed_limit_kmh) : null,
      });
      setCorridors(await fetchCorridors());
      setCorridorDetail(null);
      setSelectedCorridorId(String(created.id));
      setNotice('Corridor saved with route geometry returned by the road-routing service.');
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const submitCalibration = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCorridorId || !calibrationCameraId) return;
    try {
      const imagePoints = JSON.parse(imagePointsText) as number[][];
      const groundPoints = JSON.parse(groundPointsText) as number[][];
      const result = await saveCameraCalibration(
        selectedCorridorId, calibrationCameraId, imagePoints, groundPoints,
      );
      setNotice(`Camera calibrated. Reprojection RMSE: ${Number(result.reprojection_rmse_m).toFixed(3)} m.`);
      setCorridorDetail(await fetchCorridor(selectedCorridorId));
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const selectLinePoint = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!videoDimensions) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * videoDimensions[0]);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * videoDimensions[1]);
    setCountingLine((previous) => previous.length === 2 ? [[x, y]] : [...previous, [x, y]]);
  };

  const beginVideoProcessing = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setNotice('');
    try {
      const line = countingLine.length === 2
        ? [countingLine[0], countingLine[1]] as [[number, number], [number, number]]
        : null;
      const created = await uploadVideo(file, selectedCameraId, confidence, line);
      localStorage.setItem('trafficVideoSessionId', created.session_id);
      setSessionId(created.session_id);
      setSession(created);
      setNotice('Video accepted. Counts will be based on confirmed unique tracks.');
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const action = async (name: 'pause' | 'resume' | 'stop') => {
    if (!sessionId) return;
    try {
      await controlVideoSession(sessionId, name);
      setSession(await fetchVideoSession(sessionId));
    } catch (error) {
      setNotice(errorText(error));
    }
  };

  const summary = session?.summary as VideoSummary | undefined;
  const counts = summary?.category_counts || session?.category_counts;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header Toolbar */}
      <div className="p-3.5 rounded border border-outline-variant bg-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[18px]">videocam</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-on-surface">
                Camera Streams & Vision Ingest Monitor
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-success/15 text-success border border-success/30">
                SCADA CONTROL
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Configure CCTV RTSP nodes, link optical corridors, perform 4-point homography calibration, and run recorded inference jobs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded border border-outline-variant bg-surface-container-low font-mono text-xs text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-success"></span>
          <span>Online Nodes: {cameras.filter((c) => c.status === 'CONNECTED').length} / {cameras.length}</span>
        </div>
      </div>

      {notice && (
        <div role="status" className="p-3 rounded border border-primary/30 bg-primary/10 text-xs font-medium text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">info</span>
          <span>{notice}</span>
        </div>
      )}

      {/* Configured Cameras Stream Section */}
      <section className="p-4 rounded border border-outline-variant bg-surface flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-outline-variant pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface">
              Configured CCTV Endpoints
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-outline-variant bg-surface-container-low text-on-surface-variant">
              {cameras.length} Nodes Registered
            </span>
          </div>
        </div>

        {cameras.length === 0 ? (
          <div className="p-8 text-center rounded border border-outline-variant bg-surface-container-low flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40 mb-2">videocam_off</span>
            <p className="text-xs font-semibold text-on-surface">No cameras configured in this node network.</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Register an RTSP camera node or local video file in the form below.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {cameras.map((camera) => {
              const metrics = cameraMetrics[camera.id] || {};
              const connected = camera.status === 'CONNECTED';
              const cameraCounts = metrics.category_counts as Record<string, number> | undefined;
              return (
                <article key={camera.id} className="rounded border border-outline-variant bg-surface flex flex-col overflow-hidden">
                  {/* Stream Card Header */}
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-surface-container-low border-b border-outline-variant">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-success' : 'bg-outline'}`}></span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold text-on-surface truncate">{camera.name}</h3>
                        <p className="text-[10px] font-mono text-on-surface-variant truncate">
                          {camera.code} &bull; {camera.video_source.toUpperCase()} &bull; {camera.direction || 'Direction unspecified'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => void refreshAfterCameraAction(camera.id, !connected)}
                      disabled={busyCameraId === camera.id}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                        connected
                          ? 'bg-danger text-white hover:bg-danger/90'
                          : 'bg-primary text-white hover:bg-primary/90'
                      }`}
                    >
                      {busyCameraId === camera.id ? 'Connecting…' : connected ? 'Stop Stream' : 'Start Stream'}
                    </button>
                  </div>

                  {/* Video Screen */}
                  <div className="relative flex aspect-video items-center justify-center bg-black/90">
                    {connected ? (
                      <img
                        src={`${API_ORIGIN}/api/cameras/${encodeURIComponent(camera.id)}/stream`}
                        alt={`Live annotated stream for ${camera.name}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="px-4 text-center text-on-surface-variant flex flex-col items-center gap-1.5">
                        <span className="material-symbols-outlined text-[28px] opacity-40">videocam_off</span>
                        <span className="text-xs font-medium">Camera stream offline &bull; No live frames</span>
                      </div>
                    )}
                    <span className={`absolute left-2.5 top-2.5 rounded px-2 py-0.5 text-[10px] font-mono font-medium uppercase border ${
                      connected ? 'bg-surface/90 text-success border-success/40' : 'bg-surface/90 text-on-surface-variant border-outline-variant'
                    }`}>
                      {camera.status}
                    </span>
                  </div>

                  {/* Telemetry Stats Strip */}
                  <div className="p-2.5 grid grid-cols-2 gap-2 text-xs font-mono text-on-surface-variant bg-surface-container-low border-t border-outline-variant">
                    <div>
                      <span className="text-on-surface-variant/70 text-[10px]">Source: </span>
                      <span className="text-on-surface font-medium">{camera.video_source}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant/70 text-[10px]">Tracks: </span>
                      <span className="text-primary font-semibold">{String(metrics.confirmed_unique_tracks ?? '--')}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant/70 text-[10px]">Stream: </span>
                      <span className="text-on-surface font-medium">{String(metrics.data_source ?? 'STANDBY')}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant/70 text-[10px]">Credentials: </span>
                      <span className="text-on-surface font-medium">{camera.credentials_configured ? 'Env Set' : 'Unset'}</span>
                    </div>
                    {cameraCounts && Object.keys(cameraCounts).length > 0 && (
                      <div className="col-span-2 pt-1.5 border-t border-outline-variant/50 flex flex-wrap gap-1.5">
                        {Object.entries(cameraCounts).map(([cat, val]) => (
                          <span key={cat} className="px-1.5 py-0.2 rounded border border-outline-variant bg-surface text-[10px] text-on-surface">
                            {cat}: <strong>{val}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Row 2: Add Camera & Create Corridor Forms */}
      <section className="grid gap-4 xl:grid-cols-2 items-start">
        {/* Add Camera Form */}
        <form onSubmit={submitCamera} className="p-4 rounded border border-outline-variant bg-surface flex flex-col gap-3">
          <div className="border-b border-outline-variant pb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface">Register Camera Node</h2>
            <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">
              RTSP URLs and credentials are read via backend environment (`CAMERA_RTSP_&lt;ID&gt;`).
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['id', 'name', 'junction', 'code'] as const).map((field) => (
              <div key={field} className="flex flex-col gap-1">
                <label className="text-[10px] font-mono uppercase font-semibold text-on-surface-variant">{field.replace('_', ' ')}</label>
                <input required value={cameraForm[field]} placeholder={`Enter ${field.replace('_', ' ')}`}
                  onChange={(event) => setCameraForm({ ...cameraForm, [field]: event.target.value })}
                  className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary" />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase font-semibold text-on-surface-variant">Protocol</label>
              <select value={cameraForm.video_source} onChange={(event) => setCameraForm({ ...cameraForm, video_source: event.target.value })}
                className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs font-medium text-on-surface focus:outline-none focus:border-primary cursor-pointer">
                <option value="rtsp">RTSP (backend env)</option>
                <option value="local">Local Video File</option>
                <option value="webcam">Integrated Webcam</option>
              </select>
            </div>
            {cameraForm.video_source !== 'rtsp' && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-[10px] font-mono uppercase font-semibold text-on-surface-variant">Path / Index</label>
                <input required={cameraForm.video_source === 'local'} value={cameraForm.file_path} placeholder="Path to MP4 or device index (0)"
                  onChange={(event) => setCameraForm({ ...cameraForm, file_path: event.target.value })}
                  className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase font-semibold text-on-surface-variant">Latitude</label>
              <input value={cameraForm.latitude} placeholder="e.g. 26.8467"
                onChange={(event) => setCameraForm({ ...cameraForm, latitude: event.target.value })}
                className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase font-semibold text-on-surface-variant">Longitude</label>
              <input value={cameraForm.longitude} placeholder="e.g. 80.9462"
                onChange={(event) => setCameraForm({ ...cameraForm, longitude: event.target.value })}
                className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-[10px] font-mono uppercase font-semibold text-on-surface-variant">Compass Direction</label>
              <input value={cameraForm.direction} placeholder="e.g. Northbound / Eastbound"
                onChange={(event) => setCameraForm({ ...cameraForm, direction: event.target.value })}
                className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary" />
            </div>
          </div>
          <button className="mt-1 self-start rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors cursor-pointer">
            Save Camera Node
          </button>
        </form>

        {/* Two-Camera Corridor Form & Calibration */}
        <div className="flex flex-col gap-4">
          <form onSubmit={submitCorridor} className="p-4 rounded border border-outline-variant bg-surface flex flex-col gap-3">
            <div className="border-b border-outline-variant pb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface">Link Two-Camera Corridor</h2>
              <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">
                Calculates highway geometry and distance between two surveyed camera locations.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase font-semibold text-on-surface-variant">Corridor Label</label>
              <input required value={corridorForm.name} placeholder="e.g. MG Road Arterial Corridor"
                onChange={(event) => setCorridorForm({ ...corridorForm, name: event.target.value })}
                className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono uppercase font-semibold text-on-surface-variant">Upstream Node</label>
                <select required value={corridorForm.camera_a_id} onChange={(event) => setCorridorForm((current) => ({
                  ...current,
                  camera_a_id: event.target.value,
                  camera_b_id: current.camera_b_id === event.target.value ? '' : current.camera_b_id,
                }))}
                  className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary cursor-pointer font-medium">
                  <option value="">Select Upstream</option>
                  {cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono uppercase font-semibold text-on-surface-variant">Downstream Node</label>
                <select required value={corridorForm.camera_b_id} onChange={(event) => setCorridorForm({ ...corridorForm, camera_b_id: event.target.value })}
                  className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary cursor-pointer font-medium">
                  <option value="">Select Downstream</option>
                  {cameras.filter((camera) => camera.id !== corridorForm.camera_a_id).map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
                </select>
              </div>
              <input value={corridorForm.road_width_m} placeholder="Road width (m)"
                onChange={(event) => setCorridorForm({ ...corridorForm, road_width_m: event.target.value })}
                className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary" />
              <input value={corridorForm.num_lanes} placeholder="Lane count"
                onChange={(event) => setCorridorForm({ ...corridorForm, num_lanes: event.target.value })}
                className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <button disabled={cameras.length < 2} className="self-start rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50">
              Create Corridor
            </button>
          </form>

          {/* Active Corridors list & Calibration */}
          {corridors.length > 0 && (
            <div className="p-4 rounded border border-outline-variant bg-surface flex flex-col gap-2.5">
              <span className="text-[11px] font-mono uppercase font-semibold text-on-surface-variant">Select Corridor to Calibrate:</span>
              <div className="flex flex-col gap-1.5">
                {corridors.map((corridor) => (
                  <button type="button" key={String(corridor.id)} onClick={() => {
                    setCorridorDetail(null);
                    setSelectedCorridorId(String(corridor.id));
                  }}
                    className={`rounded p-2.5 text-left text-xs font-mono flex items-center justify-between border transition-colors cursor-pointer ${
                      selectedCorridorId === corridor.id 
                        ? 'bg-primary/10 border-primary text-primary font-semibold' 
                        : 'bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container'
                    }`}>
                    <span>{String(corridor.name)}</span>
                    <span className="text-on-surface-variant">{Number(corridor.road_length_m).toFixed(0)}m &bull; {String(corridor.data_source)}</span>
                  </button>
                ))}
              </div>

              {corridorDetail && (
                <form onSubmit={submitCalibration} className="mt-2 flex flex-col gap-2.5 rounded border border-outline-variant bg-surface-container-low p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[16px]">square_foot</span>
                    Camera Ground-Plane Homography Calibration
                  </h3>
                  <p className="text-[10px] text-on-surface-variant font-mono">
                    Input 4+ corresponding points [[x,y],...] between 2D pixel coordinates and surveyed road coordinates.
                  </p>
                  <select required value={calibrationCameraId} onChange={(event) => setCalibrationCameraId(event.target.value)}
                    className="rounded border border-outline-variant bg-surface px-2.5 py-1.5 text-xs text-on-surface font-medium">
                    <option value="">Select Target Camera</option>
                    {[String(corridorDetail.camera_a_id), String(corridorDetail.camera_b_id)].map((id) => {
                      const camera = cameras.find((item) => item.id === id);
                      return <option key={id} value={id}>{camera?.name || id}</option>;
                    })}
                  </select>
                  <textarea required value={imagePointsText} onChange={(event) => setImagePointsText(event.target.value)}
                    placeholder="Image pixel points: [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]"
                    className="min-h-16 rounded border border-outline-variant bg-surface p-2 font-mono text-[11px] text-on-surface" />
                  <textarea required value={groundPointsText} onChange={(event) => setGroundPointsText(event.target.value)}
                    placeholder="Ground coordinates (meters): [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]"
                    className="min-h-16 rounded border border-outline-variant bg-surface p-2 font-mono text-[11px] text-on-surface" />
                  <button className="self-start rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors cursor-pointer">
                    Commit Calibration Matrix
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Row 3: Recorded Video Processing & Execution */}
      <section className="grid gap-4 xl:grid-cols-2 items-start">
        {/* Upload & Configure Processing */}
        <form onSubmit={beginVideoProcessing} className="p-4 rounded border border-outline-variant bg-surface flex flex-col gap-3">
          <div className="border-b border-outline-variant pb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface">Offline Video Inference & Tracking</h2>
            <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">
              Upload CCTV footage, establish detection threshold, and draw virtual counting tripwire
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono uppercase font-semibold text-on-surface-variant">Select Video File</label>
            <input type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setCountingLine([]);
                setVideoDimensions(null);
              }}
              className="text-xs text-on-surface-variant file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white file:cursor-pointer" />
          </div>

          {previewUrl && (
            <div
              onClick={selectLinePoint}
              className="relative w-full overflow-hidden rounded bg-black border border-outline-variant cursor-crosshair"
              style={{ aspectRatio: videoDimensions ? `${videoDimensions[0]} / ${videoDimensions[1]}` : '16 / 9' }}
            >
              <video ref={previewRef} src={previewUrl} controls onLoadedMetadata={(event) => {
                const element = event.currentTarget;
                setVideoDimensions([element.videoWidth, element.videoHeight]);
              }} className="h-full w-full object-fill" />
              {videoDimensions && countingLine.length > 0 && (
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${videoDimensions[0]} ${videoDimensions[1]}`}>
                  {countingLine.length === 2 && <line x1={countingLine[0][0]} y1={countingLine[0][1]} x2={countingLine[1][0]} y2={countingLine[1][1]} stroke="#C58A24" strokeWidth="4" />}
                  {countingLine.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="8" fill="#C58A24" stroke="#ffffff" strokeWidth="1.5" />)}
                </svg>
              )}
              <span className="absolute left-2 top-2 rounded bg-black/80 px-2 py-0.5 text-[10px] font-mono text-warning border border-warning/30">
                Click two points to define virtual tripwire counting line
              </span>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase font-semibold text-on-surface-variant">Camera Association</label>
              <select value={selectedCameraId} onChange={(event) => setSelectedCameraId(event.target.value)}
                className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface font-medium focus:outline-none focus:border-primary">
                <option value="">No camera node association</option>
                {cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase font-semibold text-on-surface-variant">
                Detection Threshold: {confidence.toFixed(2)}
              </label>
              <input type="range" min="0.05" max="0.95" step="0.05" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))}
                className="mt-2 w-full accent-primary cursor-pointer" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button disabled={!file || !videoDimensions || (session !== null && !terminalStates.has(session.status))}
              className="rounded bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              <span>Execute Inference Processing</span>
            </button>
            {session && !terminalStates.has(session.status) && (
              <>
                {session.status === 'PAUSED'
                  ? <button type="button" onClick={() => void action('resume')} className="rounded border border-outline-variant bg-surface-container-low px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container cursor-pointer">Resume</button>
                  : <button type="button" onClick={() => void action('pause')} className="rounded border border-outline-variant bg-surface-container-low px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container cursor-pointer">Pause</button>}
                <button type="button" onClick={() => void action('stop')} className="rounded bg-danger px-3 py-2 text-xs font-medium text-white hover:bg-danger/90 cursor-pointer">Stop</button>
              </>
            )}
          </div>
        </form>

        {/* Processing Execution Result Panel */}
        <div className="p-4 rounded border border-outline-variant bg-surface flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-outline-variant pb-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface">Inference Telemetry Feed</h2>
              <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">
                {session ? `${session.status} &bull; Job ID: ${session.session_id}` : 'No active or historical session loaded'}
              </p>
            </div>
            {session && (
              <span className="text-sm font-semibold font-mono text-primary px-2 py-0.5 rounded border border-primary/20 bg-primary/10">
                {Number(session.progress_percent || 0).toFixed(1)}%
              </span>
            )}
          </div>

          {session ? (
            <div className="flex flex-col gap-3">
              {/* Progress bar */}
              <div className="w-full bg-surface-container-low h-2 rounded overflow-hidden border border-outline-variant">
                <div 
                  className="bg-primary h-full transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, session.progress_percent || 0))}%` }}
                />
              </div>

              <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low text-[11px] font-mono text-on-surface-variant flex flex-wrap gap-3">
                <span>Frame: <strong className="text-on-surface">{session.current_frame || 0} / {session.total_frames || 0}</strong></span>
                <span>Detections: <strong className="text-primary">{session.raw_frame_detections || 0}</strong></span>
                <span>Unique Tracks: <strong className="text-success">{session.confirmed_unique_tracks || 0}</strong></span>
                <span>Tripwire Crossings: <strong className="text-warning">{session.counted_crossings || 0}</strong></span>
              </div>

              {session.error_message && (
                <div className="p-2.5 rounded border border-danger/40 bg-surface text-xs font-medium text-danger flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{session.error_message}</span>
                </div>
              )}

              {counts && (
                <div>
                  <span className="text-[10px] font-mono font-semibold uppercase text-on-surface-variant block mb-1.5">Classified Tracks:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {Object.entries(counts).map(([category, count]) => (
                      <div key={category} className="p-2 rounded border border-outline-variant bg-surface-container-low flex flex-col justify-between">
                        <span className="text-[10px] font-mono text-on-surface-variant uppercase">{category}</span>
                        <span className="font-mono text-xs font-semibold text-on-surface mt-1">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {session.exports?.annotated_video && (
                <div className="mt-1">
                  <span className="text-[10px] font-mono font-semibold uppercase text-on-surface-variant block mb-1">Annotated Result Video:</span>
                  <video controls src={`${API_ORIGIN}${session.exports.annotated_video}`} className="max-h-64 w-full rounded bg-black border border-outline-variant" />
                </div>
              )}

              {session.exports && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-outline-variant">
                  {Object.entries(session.exports).map(([name, path]) => (
                    <a key={name} href={`${API_ORIGIN}${path}`} download
                      className="px-2.5 py-1 rounded border border-outline-variant bg-surface-container-low text-[11px] font-mono text-primary hover:underline">
                      Download {name.replaceAll('_', ' ')}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40 mb-2">analytics</span>
              <p className="text-xs font-semibold text-on-surface">No video inference session running.</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Select an MP4 file on the left to start tracking objects.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
