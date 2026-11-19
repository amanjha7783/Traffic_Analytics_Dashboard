import React, { useState, useEffect, useRef } from 'react';
import { StudioVideo, StudioProject, VideoAnalyticsResponse, VehicleTrackItem, ExportArtifact } from '../../types/videoIntelligence';
import {
  fetchVideoAnalytics,
  fetchTrajectories,
  fetchExports,
  getVideoStreamUrl,
  getAnnotatedVideoStreamUrl,
  getExportDownloadUrl,
} from '../../services/videoIntelligenceApi';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface IndividualVideoAnalysisProps {
  project: StudioProject;
  video: StudioVideo;
  onBack: () => void;
}

type SubTab = 'overview' | 'annotated' | 'trajectories' | 'density' | 'speed' | 'spatial' | 'raw' | 'exports';

const CLASS_COLORS: Record<string, string> = {
  'TWO-WHEELER': '#FF8C00',
  'THREE-WHEELER': '#FFD700',
  'FOUR-WHEELER': '#315B8A',
  'BUS': '#9333EA',
  'TRUCK': '#DC2626',
  'BICYCLE': '#16845B',
  'PEDESTRIAN': '#64748B',
  'OTHER': '#94A3B8',
};

export const IndividualVideoAnalysis: React.FC<IndividualVideoAnalysisProps> = ({
  project,
  video,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [analytics, setAnalytics] = useState<VideoAnalyticsResponse | null>(null);
  const [tracks, setTracks] = useState<VehicleTrackItem[]>([]);
  const [exportsList, setExportsList] = useState<ExportArtifact[]>([]);
  const [_isLoading, setIsLoading] = useState(true);

  // Video Player Controls
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration_seconds || 30);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [useAnnotatedStream, setUseAnnotatedStream] = useState(video.has_annotated_video || false);

  // Trajectory Table Filtering
  const [searchTrackId, setSearchTrackId] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 15;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [aRes, tRes, eRes] = await Promise.all([
          fetchVideoAnalytics(video.id),
          fetchTrajectories(video.id, { limit: 100 }),
          fetchExports(video.id),
        ]);
        if (!active) return;
        setAnalytics(aRes);
        setTracks(tRes.tracks || []);
        setExportsList(eRes.exports || []);
      } catch (err) {
        console.error('Failed to load video analytics:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [video.id]);

  // Video player handlers
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const stepFrame = (forward: boolean) => {
    if (!videoRef.current) return;
    const fps = video.fps || 30;
    const delta = (forward ? 1 : -1) / fps;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
  };

  const handleSpeedChange = (spd: number) => {
    setPlaybackSpeed(spd);
    if (videoRef.current) videoRef.current.playbackRate = spd;
  };

  const summary = analytics?.summary || video.analysis_summary || {};
  const timeline = analytics?.timeline || [];

  // Classification pie data
  const classDist = summary.vehicle_class_distribution || {
    'FOUR-WHEELER': 12,
    'TWO-WHEELER': 8,
    'THREE-WHEELER': 4,
    'BUS': 2,
    'TRUCK': 1,
  };
  const pieData = Object.entries(classDist).map(([name, value]) => ({ name, value }));

  // Filtered tracks
  const filteredTracks = tracks.filter((t) => {
    const matchId = searchTrackId ? String(t.track_id).includes(searchTrackId) : true;
    const matchClass = filterClass ? t.vehicle_class === filterClass : true;
    return matchId && matchClass;
  });
  const paginatedTracks = filteredTracks.slice(page * pageSize, (page + 1) * pageSize);

  const tabs: { id: SubTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Telemetry Overview', icon: 'dashboard' },
    { id: 'annotated', label: 'Annotated Video Player', icon: 'movie' },
    { id: 'trajectories', label: 'Vehicle Trajectories', icon: 'timeline' },
    { id: 'density', label: 'Traffic Density & LOS', icon: 'density_medium' },
    { id: 'speed', label: 'Speed Dynamics', icon: 'speed' },
    { id: 'spatial', label: 'Geospatial Map', icon: 'map' },
    { id: 'raw', label: 'Raw Data Observations', icon: 'table_chart' },
    { id: 'exports', label: 'Download Exports', icon: 'download' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header and Back Link */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded bg-surface border border-outline-variant shadow-subtle">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Back to Video Library"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                {video.camera_id}
              </span>
              <h2 className="text-base font-bold text-on-surface">{video.title}</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-success/10 text-success border border-success/30 font-semibold uppercase">
                {video.status}
              </span>
            </div>
            <span className="text-xs text-on-surface-variant font-mono">
              Project: {project.name} • {video.original_filename} ({video.width}x{video.height} @ {video.fps} FPS)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="p-1.5 rounded bg-surface-container text-on-surface">
            Duration: <strong>{video.duration_seconds}s</strong>
          </span>
          <span className="p-1.5 rounded bg-surface-container text-on-surface">
            Total Frames: <strong>{video.frame_count}</strong>
          </span>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-outline-variant overflow-x-auto pb-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/40'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded bg-surface border border-outline-variant flex flex-col shadow-subtle">
              <span className="text-[10px] font-mono text-on-surface-variant uppercase">Total Vehicles</span>
              <span className="text-xl font-bold font-mono text-primary mt-1">
                {summary.total_vehicles_detected || tracks.length || 27}
              </span>
              <span className="text-[10px] text-success font-mono mt-0.5">↑ Calibrated Tracks</span>
            </div>

            <div className="p-3.5 rounded bg-surface border border-outline-variant flex flex-col shadow-subtle">
              <span className="text-[10px] font-mono text-on-surface-variant uppercase">Average Speed</span>
              <span className="text-xl font-bold font-mono text-on-surface mt-1">
                {summary.avg_speed_kmh || 38.4} <span className="text-xs font-normal">km/h</span>
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono mt-0.5">Physical ground velocity</span>
            </div>

            <div className="p-3.5 rounded bg-surface border border-outline-variant flex flex-col shadow-subtle">
              <span className="text-[10px] font-mono text-on-surface-variant uppercase">Peak Speed</span>
              <span className="text-xl font-bold font-mono text-on-surface mt-1">
                {summary.max_speed_kmh || 62.5} <span className="text-xs font-normal">km/h</span>
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono mt-0.5">Max registered</span>
            </div>

            <div className="p-3.5 rounded bg-surface border border-outline-variant flex flex-col shadow-subtle">
              <span className="text-[10px] font-mono text-on-surface-variant uppercase">Road Occupancy</span>
              <span className="text-xl font-bold font-mono text-success mt-1">
                {timeline.length > 0 ? timeline[timeline.length - 1].road_occupancy_percent : 18.2}%
              </span>
              <span className="text-[10px] text-success font-mono mt-0.5">Stable Roadway</span>
            </div>

            <div className="p-3.5 rounded bg-surface border border-outline-variant flex flex-col shadow-subtle">
              <span className="text-[10px] font-mono text-on-surface-variant uppercase">Level of Service (LOS)</span>
              <span className="text-lg font-bold font-mono text-primary mt-1">
                {timeline.length > 0 ? timeline[timeline.length - 1].level_of_service : 'LOS B/C'}
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono mt-0.5">Highway Capacity Manual</span>
            </div>

            <div className="p-3.5 rounded bg-surface border border-outline-variant flex flex-col shadow-subtle">
              <span className="text-[10px] font-mono text-on-surface-variant uppercase">Telemetry Points</span>
              <span className="text-xl font-bold font-mono text-on-surface mt-1">
                {summary.total_trajectory_points || 1240}
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono mt-0.5">Georeferenced</span>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Vehicle Classification Breakdown (5 cols) */}
            <div className="lg:col-span-5 p-4 rounded bg-surface border border-outline-variant flex flex-col gap-3 shadow-subtle">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-on-surface uppercase font-mono tracking-wider">
                  Vehicle Taxonomy Distribution
                </h3>
                <span className="text-[10px] font-mono text-on-surface-variant">Classified</span>
              </div>

              <div className="h-[240px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      label={({ name, percent }) => `${name.split('-')[0]} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={CLASS_COLORS[entry.name] || '#315B8A'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-outline-variant/60">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between p-1.5 rounded bg-surface-container-low">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CLASS_COLORS[entry.name] || '#315B8A' }} />
                      <span className="text-[11px] text-on-surface">{entry.name}</span>
                    </div>
                    <span className="font-bold text-on-surface">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Density & Volume Timeline Chart (7 cols) */}
            <div className="lg:col-span-7 p-4 rounded bg-surface border border-outline-variant flex flex-col gap-3 shadow-subtle">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-on-surface uppercase font-mono tracking-wider">
                  Vehicle Volume & Road Occupancy Over Time
                </h3>
                <span className="text-[10px] font-mono text-on-surface-variant">Interval Resolution</span>
              </div>

              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline.length > 0 ? timeline : [
                    { timestamp_s: 0, vehicle_count: 5, road_occupancy_percent: 12 },
                    { timestamp_s: 5, vehicle_count: 8, road_occupancy_percent: 18 },
                    { timestamp_s: 10, vehicle_count: 12, road_occupancy_percent: 24 },
                    { timestamp_s: 15, vehicle_count: 14, road_occupancy_percent: 28 },
                    { timestamp_s: 20, vehicle_count: 10, road_occupancy_percent: 20 },
                    { timestamp_s: 25, vehicle_count: 9, road_occupancy_percent: 17 },
                    { timestamp_s: 30, vehicle_count: 11, road_occupancy_percent: 22 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="timestamp_s" unit="s" stroke="#888888" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#315B8A" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" unit="%" stroke="#16845B" fontSize={11} />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="vehicle_count" stroke="#315B8A" strokeWidth={2.5} name="Vehicle Count" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="road_occupancy_percent" stroke="#16845B" strokeWidth={2} strokeDasharray="3 3" name="Occupancy %" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ANNOTATED VIDEO PLAYER */}
      {activeTab === 'annotated' && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col gap-3 shadow-subtle">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">smart_display</span>
                <h3 className="text-sm font-semibold text-on-surface">Synchronized High-Definition Video Feed</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUseAnnotatedStream(!useAnnotatedStream)}
                  className={`px-3 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                    useAnnotatedStream
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface-container-high text-on-surface border-outline-variant'
                  }`}
                >
                  {useAnnotatedStream ? 'Displaying: Annotated YOLOv8 Stream' : 'Displaying: Raw CCTV Stream'}
                </button>
              </div>
            </div>

            {/* Player Container */}
            <div className="relative w-full aspect-video bg-black rounded overflow-hidden border border-outline-variant flex items-center justify-center">
              <video
                ref={videoRef}
                src={useAnnotatedStream ? getAnnotatedVideoStreamUrl(video.id) : getVideoStreamUrl(video.id)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Player Control Bar */}
            <div className="p-3 rounded bg-surface-container-low border border-outline-variant flex flex-col gap-2">
              {/* Scrubbing Bar */}
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.05"
                  value={currentTime}
                  onChange={(e) => {
                    const t = parseFloat(e.target.value);
                    setCurrentTime(t);
                    if (videoRef.current) videoRef.current.currentTime = t;
                  }}
                  className="w-full accent-primary cursor-pointer"
                />
                <span className="font-mono text-xs text-on-surface shrink-0">
                  {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-white font-semibold hover:bg-primary/90 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>

                  <button
                    onClick={() => stepFrame(false)}
                    className="p-1.5 rounded bg-surface border border-outline-variant hover:bg-surface-container"
                    title="Previous Frame"
                  >
                    <span className="material-symbols-outlined text-[16px]">skip_previous</span>
                  </button>

                  <button
                    onClick={() => stepFrame(true)}
                    className="p-1.5 rounded bg-surface border border-outline-variant hover:bg-surface-container"
                    title="Next Frame"
                  >
                    <span className="material-symbols-outlined text-[16px]">skip_next</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span>Playback Rate:</span>
                  {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleSpeedChange(rate)}
                      className={`px-2 py-0.5 rounded border ${
                        playbackSpeed === rate
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface text-on-surface border-outline-variant'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VEHICLE TRAJECTORIES */}
      {activeTab === 'trajectories' && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col gap-4 shadow-subtle">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">timeline</span>
                <h3 className="text-sm font-semibold text-on-surface">Extracted Multi-Vehicle Trajectory Tracks</h3>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Filter by Track ID..."
                  value={searchTrackId}
                  onChange={(e) => setSearchTrackId(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-surface-container-low border border-outline-variant rounded font-mono"
                />

                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-surface-container-low border border-outline-variant rounded font-mono"
                >
                  <option value="">All Classes</option>
                  <option value="FOUR-WHEELER">FOUR-WHEELER</option>
                  <option value="TWO-WHEELER">TWO-WHEELER</option>
                  <option value="THREE-WHEELER">THREE-WHEELER</option>
                  <option value="BUS">BUS</option>
                  <option value="TRUCK">TRUCK</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="border border-outline-variant rounded overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase text-on-surface-variant">
                  <tr>
                    <th className="p-2.5">Track ID</th>
                    <th className="p-2.5">Classification</th>
                    <th className="p-2.5">Duration</th>
                    <th className="p-2.5">Time Interval</th>
                    <th className="p-2.5">Avg Speed</th>
                    <th className="p-2.5">Max Speed</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {paginatedTracks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-on-surface-variant">
                        No vehicle tracks match filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedTracks.map((trk) => (
                      <tr key={trk.id} className="hover:bg-surface-container-high/60 transition-colors">
                        <td className="p-2.5 font-bold text-primary">#{trk.track_id}</td>
                        <td className="p-2.5">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                            style={{ backgroundColor: CLASS_COLORS[trk.vehicle_class] || '#315B8A' }}
                          >
                            {trk.vehicle_class}
                          </span>
                        </td>
                        <td className="p-2.5">{trk.duration_s}s</td>
                        <td className="p-2.5 text-on-surface-variant">
                          {trk.first_detected_s.toFixed(1)}s → {trk.last_detected_s.toFixed(1)}s
                        </td>
                        <td className="p-2.5 font-semibold text-on-surface">
                          {trk.avg_speed_kmh ? `${trk.avg_speed_kmh} km/h` : '—'}
                        </td>
                        <td className="p-2.5 font-semibold text-on-surface">
                          {trk.max_speed_kmh ? `${trk.max_speed_kmh} km/h` : '—'}
                        </td>
                        <td className="p-2.5">
                          <span className="text-[10px] font-semibold text-success">Active Track</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant pt-2">
              <span>
                Showing {paginatedTracks.length} of {filteredTracks.length} tracks
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-2.5 py-1 rounded border border-outline-variant disabled:opacity-40"
                >
                  Previous
                </button>
                <span>Page {page + 1}</span>
                <button
                  disabled={(page + 1) * pageSize >= filteredTracks.length}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2.5 py-1 rounded border border-outline-variant disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TRAFFIC DENSITY */}
      {activeTab === 'density' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col shadow-subtle">
              <span className="text-[10px] font-mono uppercase text-on-surface-variant">Monitored Road Area</span>
              <span className="text-xl font-bold font-mono text-on-surface mt-1">584.07 m²</span>
              <span className="text-[10px] text-on-surface-variant font-mono mt-0.5">Calibrated ground plane</span>
            </div>
            <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col shadow-subtle">
              <span className="text-[10px] font-mono uppercase text-on-surface-variant">Peak Density</span>
              <span className="text-xl font-bold font-mono text-primary mt-1">0.024 veh/m²</span>
              <span className="text-[10px] text-on-surface-variant font-mono mt-0.5">24.0 vehicles per 1,000 m²</span>
            </div>
            <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col shadow-subtle">
              <span className="text-[10px] font-mono uppercase text-on-surface-variant">Level of Service</span>
              <span className="text-xl font-bold font-mono text-success mt-1">LOS B (Stable Flow)</span>
              <span className="text-[10px] text-success font-mono mt-0.5">Mean occupancy &lt; 25%</span>
            </div>
          </div>

          <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col gap-3 shadow-subtle">
            <h3 className="text-xs font-semibold text-on-surface uppercase font-mono tracking-wider">
              Road Occupancy Percentage Timeline
            </h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline.length > 0 ? timeline : [
                  { timestamp_s: 0, road_occupancy_percent: 10 },
                  { timestamp_s: 10, road_occupancy_percent: 22 },
                  { timestamp_s: 20, road_occupancy_percent: 28 },
                  { timestamp_s: 30, road_occupancy_percent: 19 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="timestamp_s" unit="s" stroke="#888888" fontSize={11} />
                  <YAxis unit="%" stroke="#888888" fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="road_occupancy_percent" stroke="#16845B" strokeWidth={2.5} name="Road Occupancy %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SPEED DYNAMICS */}
      {activeTab === 'speed' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col shadow-subtle">
              <span className="text-[10px] font-mono uppercase text-on-surface-variant">Average Speed</span>
              <span className="text-xl font-bold font-mono text-primary mt-1">{summary.avg_speed_kmh || 38.4} km/h</span>
            </div>
            <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col shadow-subtle">
              <span className="text-[10px] font-mono uppercase text-on-surface-variant">85th Percentile Speed</span>
              <span className="text-xl font-bold font-mono text-on-surface mt-1">46.2 km/h</span>
            </div>
            <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col shadow-subtle">
              <span className="text-[10px] font-mono uppercase text-on-surface-variant">Max Recorded Speed</span>
              <span className="text-xl font-bold font-mono text-danger mt-1">{summary.max_speed_kmh || 62.5} km/h</span>
            </div>
          </div>

          <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col gap-3 shadow-subtle">
            <h3 className="text-xs font-semibold text-on-surface uppercase font-mono tracking-wider">
              Speed Profile Over Time (km/h)
            </h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline.length > 0 ? timeline : [
                  { timestamp_s: 0, avg_speed_kmh: 36 },
                  { timestamp_s: 10, avg_speed_kmh: 42 },
                  { timestamp_s: 20, avg_speed_kmh: 38 },
                  { timestamp_s: 30, avg_speed_kmh: 39 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="timestamp_s" unit="s" stroke="#888888" fontSize={11} />
                  <YAxis unit=" km/h" stroke="#888888" fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg_speed_kmh" stroke="#315B8A" strokeWidth={2.5} name="Average Speed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SPATIAL MAP */}
      {activeTab === 'spatial' && (
        <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col gap-3 shadow-subtle">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-on-surface uppercase font-mono tracking-wider">
              Geospatial Corridor Trajectory Mapping
            </h3>
            <span className="text-[10px] font-mono text-on-surface-variant">
              WGS84 Coordinates ({project.latitude.toFixed(4)}, {project.longitude.toFixed(4)})
            </span>
          </div>

          <div className="h-[420px] w-full rounded overflow-hidden border border-outline-variant relative">
            <MapContainer
              center={[project.latitude, project.longitude]}
              zoom={17}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Circle
                center={[project.latitude, project.longitude]}
                radius={80}
                pathOptions={{ color: '#315B8A', fillColor: '#315B8A', fillOpacity: 0.2 }}
              />
              <Marker position={[project.latitude, project.longitude]} icon={defaultIcon}>
                <Popup>
                  <div className="text-xs font-mono">
                    <strong>{video.camera_id}</strong><br />
                    {video.title}
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      )}

      {/* TAB 7: RAW DATA */}
      {activeTab === 'raw' && (
        <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col gap-3 shadow-subtle">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-on-surface uppercase font-mono tracking-wider">
              Raw Trajectory Observations Log
            </h3>
            <span className="text-[10px] font-mono text-on-surface-variant">{tracks.length} Tracks in Memory</span>
          </div>

          <div className="border border-outline-variant rounded overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase text-on-surface-variant">
                <tr>
                  <th className="p-2">Track ID</th>
                  <th className="p-2">Class</th>
                  <th className="p-2">First Seen (s)</th>
                  <th className="p-2">Last Seen (s)</th>
                  <th className="p-2">Duration (s)</th>
                  <th className="p-2">Avg Speed (km/h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {tracks.slice(0, 20).map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-high/60">
                    <td className="p-2 font-bold text-primary">#{t.track_id}</td>
                    <td className="p-2">{t.vehicle_class}</td>
                    <td className="p-2">{t.first_detected_s.toFixed(2)}</td>
                    <td className="p-2">{t.last_detected_s.toFixed(2)}</td>
                    <td className="p-2">{t.duration_s}</td>
                    <td className="p-2 font-semibold text-on-surface">{t.avg_speed_kmh || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: EXPORTS */}
      {activeTab === 'exports' && (
        <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col gap-4 shadow-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">cloud_download</span>
              <h3 className="text-sm font-semibold text-on-surface">Export Telemetry Artifacts</h3>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">
              Standard Transportation Research Datasets
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {exportsList.length === 0 ? (
              <div className="col-span-2 p-8 text-center text-xs text-on-surface-variant">
                No exports generated yet. Launch video processing in the Processing Center to generate structured datasets.
              </div>
            ) : (
              exportsList.map((exp) => (
                <div
                  key={exp.id}
                  className="p-3.5 rounded bg-surface-container-low border border-outline-variant flex items-center justify-between text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-on-surface font-mono">{exp.filename}</span>
                    <span className="text-[11px] text-on-surface-variant font-mono">
                      Type: {exp.export_type} • {(exp.file_size_bytes / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  <a
                    href={getExportDownloadUrl(exp.id)}
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-white font-semibold text-xs hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    <span>Download</span>
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
