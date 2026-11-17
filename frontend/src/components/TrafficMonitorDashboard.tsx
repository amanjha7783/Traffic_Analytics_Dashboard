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
      setNotice('Camera configuration saved. RTSP credentials are read from the backend environment.');
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
    <div className="flex flex-col gap-space-lg">
      <header className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-space-lg">
        <h1 className="font-headline-lg font-bold text-on-surface">Camera & Recorded Video Monitor</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Only configured sources and detector results are shown. Physical speed and occupancy stay unavailable without calibration.
        </p>
        {notice && <p role="status" className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-on-surface">{notice}</p>}
      </header>

      <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-space-lg">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-headline-md font-semibold text-on-surface">Configured Cameras</h2>
          <span className="text-xs text-on-surface-variant">{cameras.length} configured</span>
        </div>
        {cameras.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No cameras are configured. Add a camera below; no demo feeds are substituted.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {cameras.map((camera) => {
              const metrics = cameraMetrics[camera.id] || {};
              const connected = camera.status === 'CONNECTED';
              const cameraCounts = metrics.category_counts as Record<string, number> | undefined;
              return (
                <article key={camera.id} className="overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container">
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div>
                      <h3 className="font-semibold text-on-surface">{camera.name}</h3>
                      <p className="text-xs text-on-surface-variant">{camera.code} · {camera.video_source} · {camera.direction || 'Direction not set'}</p>
                    </div>
                    <button
                      onClick={() => void refreshAfterCameraAction(camera.id, !connected)}
                      disabled={busyCameraId === camera.id}
                      className="rounded-lg bg-primary-container px-3 py-2 text-xs font-semibold text-on-primary-container disabled:opacity-50"
                    >
                      {busyCameraId === camera.id ? 'Working…' : connected ? 'Stop' : 'Start'}
                    </button>
                  </div>
                  <div className="relative flex aspect-video items-center justify-center bg-black">
                    {connected ? (
                      <img
                        src={`${API_ORIGIN}/api/cameras/${encodeURIComponent(camera.id)}/stream`}
                        alt={`Live annotated stream for ${camera.name}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="px-4 text-center text-sm text-slate-400">Camera disconnected — no live frames available</span>
                    )}
                    <span className={`absolute left-3 top-3 rounded px-2 py-1 text-xs ${connected ? 'bg-emerald-900/80 text-emerald-200' : 'bg-slate-900/80 text-slate-300'}`}>
                      {camera.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-3 text-xs text-on-surface-variant">
                    <span>Source: {camera.video_source || 'not set'}</span>
                    <span>Credentials: {camera.credentials_configured ? 'configured in backend' : 'not configured'}</span>
                    <span>Detected tracks: {String(metrics.confirmed_unique_tracks ?? '--')}</span>
                    <span>Data: {String(metrics.data_source ?? 'UNAVAILABLE')}</span>
                    {cameraCounts && Object.entries(cameraCounts).map(([category, count]) => (
                      <span key={category}>{category}: {count}</span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-space-lg xl:grid-cols-2">
        <form onSubmit={submitCamera} className="flex flex-col gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low p-space-lg">
          <h2 className="font-headline-md font-semibold text-on-surface">Add Camera</h2>
          <p className="text-xs text-on-surface-variant">RTSP URLs and passwords are never entered into or returned by the browser. Configure the normalized `CAMERA_RTSP_&lt;ID&gt;` variable in the backend environment.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['id', 'name', 'junction', 'code'] as const).map((field) => (
              <input key={field} required value={cameraForm[field]} placeholder={field.replace('_', ' ')}
                onChange={(event) => setCameraForm({ ...cameraForm, [field]: event.target.value })}
                className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface" />
            ))}
            <select value={cameraForm.video_source} onChange={(event) => setCameraForm({ ...cameraForm, video_source: event.target.value })}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface">
              <option value="rtsp">RTSP (env credential)</option><option value="local">Local video</option><option value="webcam">Webcam</option>
            </select>
            {cameraForm.video_source !== 'rtsp' && <input required={cameraForm.video_source === 'local'} value={cameraForm.file_path} placeholder="Backend video path / webcam index"
              onChange={(event) => setCameraForm({ ...cameraForm, file_path: event.target.value })}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface" />}
            <input value={cameraForm.latitude} placeholder="Latitude"
              onChange={(event) => setCameraForm({ ...cameraForm, latitude: event.target.value })}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface" />
            <input value={cameraForm.longitude} placeholder="Longitude"
              onChange={(event) => setCameraForm({ ...cameraForm, longitude: event.target.value })}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface" />
            <input value={cameraForm.direction} placeholder="Travel direction"
              onChange={(event) => setCameraForm({ ...cameraForm, direction: event.target.value })}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface" />
          </div>
          <button className="self-start rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container">Save Camera</button>
        </form>

        <form onSubmit={submitCorridor} className="flex flex-col gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low p-space-lg">
          <h2 className="font-headline-md font-semibold text-on-surface">Two-Camera Corridor</h2>
          <p className="text-xs text-on-surface-variant">Road geometry and distance come from the routing service using configured camera coordinates; missing coordinates or route data are errors, not estimates.</p>
          <input required value={corridorForm.name} placeholder="Corridor name"
            onChange={(event) => setCorridorForm({ ...corridorForm, name: event.target.value })}
            className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface" />
          <div className="grid gap-3 sm:grid-cols-2">
            <select required value={corridorForm.camera_a_id} onChange={(event) => setCorridorForm({ ...corridorForm, camera_a_id: event.target.value })}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface">
              <option value="">Upstream camera</option>{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
            </select>
            <select required value={corridorForm.camera_b_id} onChange={(event) => setCorridorForm({ ...corridorForm, camera_b_id: event.target.value })}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface">
              <option value="">Downstream camera</option>{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
            </select>
            <input value={corridorForm.road_width_m} placeholder="Measured road width (m)"
              onChange={(event) => setCorridorForm({ ...corridorForm, road_width_m: event.target.value })}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface" />
            <input value={corridorForm.num_lanes} placeholder="Lane count"
              onChange={(event) => setCorridorForm({ ...corridorForm, num_lanes: event.target.value })}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface" />
            <input value={corridorForm.speed_limit_kmh} placeholder="Speed limit (km/h)"
              onChange={(event) => setCorridorForm({ ...corridorForm, speed_limit_kmh: event.target.value })}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface" />
            <input value={corridorForm.direction} placeholder="Direction"
              onChange={(event) => setCorridorForm({ ...corridorForm, direction: event.target.value })}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface" />
          </div>
          <button disabled={cameras.length < 2} className="self-start rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container disabled:opacity-50">Create Corridor</button>
        </form>
        <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low p-space-lg">
          {corridors.map((corridor) => (
            <button type="button" key={String(corridor.id)} onClick={() => {
              setCorridorDetail(null);
              setSelectedCorridorId(String(corridor.id));
            }}
              className={`rounded-lg p-3 text-left text-xs ${selectedCorridorId === corridor.id ? 'bg-primary/10 text-on-surface' : 'bg-surface-container text-on-surface-variant'}`}>
              {String(corridor.name)} · {Number(corridor.road_length_m).toFixed(0)} m · {String(corridor.data_source)}
            </button>
          ))}
          {corridorDetail && (
            <form onSubmit={submitCalibration} className="mt-2 flex flex-col gap-2 rounded-lg border border-outline-variant/20 bg-surface-container p-3">
              <h3 className="text-sm font-semibold text-on-surface">Camera Ground-Plane Calibration</h3>
              <p className="text-xs text-on-surface-variant">Enter at least four paired image-pixel and measured road-plane coordinates. Use the same point order for both arrays.</p>
              <select required value={calibrationCameraId} onChange={(event) => setCalibrationCameraId(event.target.value)}
                className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface">
                <option value="">Select corridor camera</option>
                {[String(corridorDetail.camera_a_id), String(corridorDetail.camera_b_id)].map((id) => {
                  const camera = cameras.find((item) => item.id === id);
                  return <option key={id} value={id}>{camera?.name || id}</option>;
                })}
              </select>
              <textarea required value={imagePointsText} onChange={(event) => setImagePointsText(event.target.value)}
                placeholder="Image points: [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]"
                className="min-h-20 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 font-mono text-xs text-on-surface" />
              <textarea required value={groundPointsText} onChange={(event) => setGroundPointsText(event.target.value)}
                placeholder="Ground points in meters: [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]"
                className="min-h-20 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 font-mono text-xs text-on-surface" />
              <button className="self-start rounded-lg bg-primary-container px-3 py-2 text-xs font-semibold text-on-primary-container">Save Calibration</button>
              {Array.isArray(corridorDetail.calibrations) && (corridorDetail.calibrations as Array<Record<string, unknown>>).map((calibration) => (
                <p key={String(calibration.camera_id)} className="text-xs text-on-surface-variant">
                  {String(calibration.camera_id)}: {calibration.is_calibrated ? 'calibrated' : 'not calibrated'} · RMSE {String(calibration.reprojection_rmse_m ?? 'unavailable')} m
                </p>
              ))}
            </form>
          )}
        </div>
      </section>

      <section className="grid gap-space-lg xl:grid-cols-2">
        <form onSubmit={beginVideoProcessing} className="flex flex-col gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-low p-space-lg">
          <div>
            <h2 className="font-headline-md font-semibold text-on-surface">Process Recorded Video</h2>
            <p className="mt-1 text-xs text-on-surface-variant">Counts are confirmed unique tracks. Standard COCO weights cannot distinguish three-wheelers; they remain unavailable unless custom weights and a class map are supplied.</p>
          </div>
          <input type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setCountingLine([]);
              setVideoDimensions(null);
            }}
            className="text-sm text-on-surface-variant file:mr-3 file:rounded-lg file:border-0 file:bg-surface-container-high file:px-3 file:py-2 file:text-on-surface" />
          {previewUrl && (
            <div
              onClick={selectLinePoint}
              className="relative w-full overflow-hidden bg-black"
              style={{ aspectRatio: videoDimensions ? `${videoDimensions[0]} / ${videoDimensions[1]}` : '16 / 9' }}
            >
              <video ref={previewRef} src={previewUrl} controls onLoadedMetadata={(event) => {
                const element = event.currentTarget;
                setVideoDimensions([element.videoWidth, element.videoHeight]);
              }} className="h-full w-full object-fill" />
              {videoDimensions && countingLine.length > 0 && (
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${videoDimensions[0]} ${videoDimensions[1]}`}>
                  {countingLine.length === 2 && <line x1={countingLine[0][0]} y1={countingLine[0][1]} x2={countingLine[1][0]} y2={countingLine[1][1]} stroke="#facc15" strokeWidth="5" />}
                  {countingLine.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="12" fill="#facc15" />)}
                </svg>
              )}
              <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white">Click two points to define a counting line (optional)</span>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={selectedCameraId} onChange={(event) => setSelectedCameraId(event.target.value)}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface">
              <option value="">No camera association</option>{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              Confidence: {confidence.toFixed(2)}
              <input type="range" min="0.05" max="0.95" step="0.05" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={!file || !videoDimensions || (session !== null && !terminalStates.has(session.status))}
              className="rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container disabled:opacity-50">
              Start Processing
            </button>
            {session && !terminalStates.has(session.status) && (
              <>
                {session.status === 'PAUSED'
                  ? <button type="button" onClick={() => void action('resume')} className="rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface">Resume</button>
                  : <button type="button" onClick={() => void action('pause')} className="rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface">Pause</button>}
                <button type="button" onClick={() => void action('stop')} className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">Stop</button>
              </>
            )}
          </div>
        </form>

        <div className="flex flex-col gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-low p-space-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-headline-md font-semibold text-on-surface">Processing Result</h2>
              <p className="text-xs text-on-surface-variant">{session ? `${session.status} · ${session.session_id}` : 'No video session selected'}</p>
            </div>
            {session && <span className="text-sm font-mono text-primary">{Number(session.progress_percent || 0).toFixed(1)}%</span>}
          </div>
          {session && (
            <>
              <progress max={100} value={session.progress_percent || 0} className="w-full" />
              <p className="text-xs text-on-surface-variant">
                Frame {session.current_frame || 0} / {session.total_frames || 0} · {session.raw_frame_detections || 0} raw detections · {session.confirmed_unique_tracks || 0} confirmed unique tracks · {session.counted_crossings || 0} line crossings
              </p>
              {session.error_message && <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{session.error_message}</p>}
              {counts && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {Object.entries(counts).map(([category, count]) => (
                    <div key={category} className="rounded-lg bg-surface-container p-3">
                      <p className="text-[10px] text-on-surface-variant">{category}</p>
                      <p className="text-lg font-semibold text-on-surface">{count}</p>
                    </div>
                  ))}
                </div>
              )}
              {summary && <p className="text-xs text-on-surface-variant">
                {summary.data_source} · motor vehicles: {summary.total_motor_vehicles ?? '--'} · including bicycles: {summary.total_vehicles_including_bicycle ?? '--'}
                {summary.is_partial ? ' · partial processing' : ''}
              </p>}
              {session.exports && Object.entries(session.exports).map(([name, path]) => (
                <a key={name} href={`${API_ORIGIN}${path}`} className="text-sm text-primary underline">{name.replaceAll('_', ' ')}</a>
              ))}
              {session.exports?.annotated_video && (
                <video controls src={`${API_ORIGIN}${session.exports.annotated_video}`} className="mt-2 max-h-80 w-full rounded-lg bg-black" />
              )}
              {summary?.speed_note && <p className="text-xs text-amber-300">{summary.speed_note}</p>}
            </>
          )}
        </div>
      </section>
    </div>
  );
};
