import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  StudioVideo,
  VideoAnalyticsResponse,
  TrajectoryPointItem,
} from '../../types/videoIntelligence';
import {
  fetchVideoDetails,
  fetchVideoAnalytics,
  fetchTrajectoryPoints,
  getAnnotatedVideoStreamUrl,
  getVideoStreamUrl,
  getTrajectoriesCsvUrl,
  getObservationFrameUrl,
} from '../../services/videoIntelligenceApi';

export const SimpleVideoAnalyticsPage: React.FC = () => {
  const { projectId, videoId } = useParams<{ projectId: string; videoId: string }>();
  const navigate = useNavigate();

  const [video, setVideo] = useState<StudioVideo | null>(null);
  const [analytics, setAnalytics] = useState<VideoAnalyticsResponse | null>(null);
  const [points, setPoints] = useState<TrajectoryPointItem[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);

  // Pagination & Filtering
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [searchTrackId, setSearchTrackId] = useState<string>('');
  const [filterClass, setFilterClass] = useState<string>('');
  const [sortBy, setSortBy] = useState<'timestamp_s' | 'track_id' | 'speed_kmh'>('timestamp_s');
  const [sortAsc, setSortAsc] = useState(true);

  // Active highlighted track & Frame Inspection Modal
  const [selectedPoint, setSelectedPoint] = useState<TrajectoryPointItem | null>(null);
  const [inspectingPoint, setInspectingPoint] = useState<TrajectoryPointItem | null>(null);
  const [isFrameLoading, setIsFrameLoading] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Load video details and analytics once or on videoId change
  useEffect(() => {
    if (!videoId) return;

    setIsLoading(true);
    Promise.all([
      fetchVideoDetails(videoId),
      fetchVideoAnalytics(videoId),
    ])
      .then(([vData, aData]) => {
        setVideo(vData);
        setAnalytics(aData);
      })
      .catch((err: any) => {
        console.error('Failed to load video analytics', err);
        setErrorMsg(err?.response?.data?.detail || 'Failed to load video analytics.');
      })
      .finally(() => setIsLoading(false));
  }, [videoId]);

  // Load trajectory points whenever page, track search, or class filter changes
  useEffect(() => {
    if (!videoId) return;

    const parsedTrackId = searchTrackId.trim() ? parseInt(searchTrackId.trim(), 10) : undefined;
    const activeTrackFilter = !isNaN(parsedTrackId as number) ? parsedTrackId : undefined;
    const activeClassFilter = filterClass.trim() ? filterClass.trim() : undefined;

    fetchTrajectoryPoints(videoId, {
      limit: pageSize,
      offset: page * pageSize,
      track_id: activeTrackFilter,
      vehicle_class: activeClassFilter,
    })
      .then((pData) => {
        setPoints(pData.points);
        setTotalPoints(pData.total);
      })
      .catch((err: any) => {
        console.error('Failed to fetch trajectory points', err);
      });
  }, [videoId, page, searchTrackId, filterClass]);

  // Open Frame Inspection Modal
  const handleOpenInspection = (point: TrajectoryPointItem) => {
    setSelectedPoint(point);
    setInspectingPoint(point);
    setIsFrameLoading(true);
  };

  // Jump Video to Timestamp and seek player
  const handleJumpToTimestamp = (timestamp_s: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp_s;
      videoRef.current.play().catch(() => {});
      playerContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setInspectingPoint(null);
  };

  // Client-side sort within current page
  const sortedPoints = [...points].sort((a, b) => {
    const valA = a[sortBy] ?? -1;
    const valB = b[sortBy] ?? -1;
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const toggleSort = (field: 'timestamp_s' | 'track_id' | 'speed_kmh') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  };

  // Prepare Class Distribution Chart Data (Graph 4)
  const classDist = analytics?.summary?.vehicle_class_distribution || analytics?.summary?.unique_class_distribution || {};
  const classChartData = Object.entries(classDist).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
    count,
  }));

  // Timeline data for Graphs 1, 2, 3
  const timelineData = (analytics?.timeline || []).map((t) => ({
    time: `${t.timestamp_s.toFixed(1)}s`,
    timestamp_s: t.timestamp_s,
    active_vehicles: t.active_vehicles ?? t.vehicle_count ?? 0,
    cumulative_unique_vehicles: t.cumulative_unique_vehicles ?? t.vehicle_count ?? 0,
    avg_speed_kmh: t.avg_speed_kmh !== null && t.avg_speed_kmh !== undefined ? Number(t.avg_speed_kmh.toFixed(1)) : null,
    density_veh_sqm: t.density_veh_sqm !== null && t.density_veh_sqm !== undefined ? Number(t.density_veh_sqm.toFixed(4)) : null,
    density_veh_sqkm: t.density_veh_sqkm !== null && t.density_veh_sqkm !== undefined ? Number(t.density_veh_sqkm.toFixed(1)) : null,
    road_occupancy_percent: t.road_occupancy_percent !== null && t.road_occupancy_percent !== undefined ? Number(t.road_occupancy_percent.toFixed(1)) : null,
    active_inside_region: (t as any).active_inside_region ?? null,
  }));


  // Helper for badge color by vehicle class
  const getClassBadgeStyle = (cls: string) => {
    const normalized = cls.toUpperCase();
    if (normalized.includes('FOUR') || normalized.includes('CAR')) {
      return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
    }
    if (normalized.includes('PED')) {
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    }
    if (normalized.includes('BUS')) {
      return 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
    }
    if (normalized.includes('TWO') || normalized.includes('MOTOR')) {
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    }
    return 'bg-slate-700/40 text-slate-300 border border-slate-600/40';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-on-surface-variant min-h-[50vh]">
        <span className="material-symbols-outlined animate-spin text-[40px] text-primary">progress_activity</span>
        <span className="mt-4 text-xs font-mono tracking-wider uppercase text-slate-400">
          Loading video analytics & trajectory dataset...
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex flex-col w-full max-w-[1440px] gap-6 py-4 px-4 pb-16">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-outline-variant pb-4 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/video-intelligence/projects/${projectId}/history`)}
            className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Go to Project History"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <div className="text-[10px] font-mono uppercase text-primary font-bold tracking-wider">
              TrafficOps • Video Intelligence Analytics
            </div>
            <h1 className="text-lg font-bold text-on-surface tracking-tight">
              {video?.title || video?.original_filename || 'Video Feed Analytics'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/video-intelligence/projects/${projectId}/history`)}
            className="px-3 py-1.5 border border-outline-variant hover:bg-surface-container rounded text-xs font-medium text-on-surface transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span>Project History</span>
          </button>
          <a
            href={getAnnotatedVideoStreamUrl(videoId!)}
            download={`${video?.title || 'annotated_video'}.mp4`}
            className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-on-primary rounded text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Download Annotated MP4</span>
          </a>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-error-container/20 border border-error text-error text-xs rounded flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SECTION A: Annotated Video Player */}
      <div ref={playerContainerRef} className="flex flex-col gap-2 bg-surface p-4 rounded-xl border border-outline-variant shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">videocam</span>
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface font-mono">
              Annotated Video Feed (YOLOv8 + ByteTrack)
            </span>
          </div>
          {selectedPoint && (
            <div className="text-xs font-mono bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded flex items-center gap-2 animate-pulse">
              <span className="material-symbols-outlined text-[16px]">my_location</span>
              <span>
                Target Track #{selectedPoint.track_id} ({selectedPoint.vehicle_class}) at {selectedPoint.timestamp_s}s
                {selectedPoint.speed_kmh !== null ? ` | ${selectedPoint.speed_kmh} km/h` : ''}
              </span>
            </div>
          )}
        </div>

        <div className="w-full flex justify-center bg-slate-950/60 rounded-lg p-3 border border-outline-variant/40">
          <div className="relative w-full max-w-[760px] aspect-video max-h-[420px] bg-black rounded-md overflow-hidden flex items-center justify-center shadow-lg border border-slate-800">
            <video
              ref={videoRef}
              src={getAnnotatedVideoStreamUrl(videoId!)}
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-contain"
              onError={() => {
                if (videoRef.current && videoId) {
                  videoRef.current.src = getVideoStreamUrl(videoId);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* SECTION B: EXACTLY FOUR GRAPHS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* GRAPH 1: Vehicle Count Over Time (Active vs Cumulative Unique) */}
        <div className="p-4 rounded-xl bg-surface border border-outline-variant flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-outline-variant pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400 text-[18px]">timeline</span>
              <div className="text-xs font-bold text-on-surface font-mono uppercase">
                Graph 1: Vehicle Count Over Time
              </div>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">Active vs Cumulative</span>
          </div>
          <div className="h-64 w-full">
            {timelineData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-on-surface-variant text-xs font-mono">
                No telemetry time-series observations available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="time"
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    name="Time"
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={11}
                    allowDecimals={false}
                    name="Vehicles"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '12px' }}
                    formatter={(val: any, name: any) => [val, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line
                    type="monotone"
                    dataKey="active_vehicles"
                    name="Active Vehicles in Interval"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative_unique_vehicles"
                    name="Cumulative Unique Vehicles"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* GRAPH 2: Average Vehicle Speed (km/h) */}
        <div className="p-4 rounded-xl bg-surface border border-outline-variant flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-outline-variant pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-400 text-[18px]">speed</span>
              <div className="text-xs font-bold text-on-surface font-mono uppercase">
                Graph 2: Average Vehicle Speed
              </div>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">Time (s) vs Speed (km/h)</span>
          </div>
          <div className="h-64 w-full">
            {!analytics?.has_calibration ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900/40 rounded-lg border border-dashed border-slate-700/60">
                <span className="material-symbols-outlined text-[32px] text-amber-400 mb-2">tune</span>
                <div className="text-xs font-bold text-slate-200 font-mono uppercase mb-1">
                  Planar Homography Calibration Required
                </div>
                <p className="text-[11px] text-slate-400 max-w-sm">
                  Vehicle speed calculations require 4-point ground control calibration. Calibrate the camera to unlock real-time metric speeds.
                </p>
              </div>
            ) : timelineData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-on-surface-variant text-xs font-mono">
                No speed observations recorded.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="time" stroke="#888888" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#888888"
                    fontSize={11}
                    unit=" km/h"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '12px' }}
                    formatter={(val: any) => [`${val} km/h`, 'Average Speed']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line
                    type="monotone"
                    dataKey="avg_speed_kmh"
                    name="Average Speed (km/h)"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* GRAPH 3: Traffic Density & Road Occupancy */}
        <div className="p-4 rounded-xl bg-surface border border-outline-variant flex flex-col shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 border-b border-outline-variant pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-[18px]">grid_4x4</span>
              <div className="text-xs font-bold text-on-surface font-mono uppercase">
                Graph 3: Traffic Density & Road Occupancy
              </div>
            </div>
            {analytics?.has_road_area && (
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-surface-container-low border border-outline-variant text-amber-400">
                  Area: <strong>{analytics.road_area_sqm?.toFixed(1)} m²</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-low border border-outline-variant text-on-surface">
                  Avg: <strong>{analytics.density_stats?.avg_density_veh_sqkm ?? '—'} veh/km²</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-low border border-outline-variant text-cyan-400">
                  Occ: <strong>{analytics.density_stats?.avg_occupancy_percent ?? '—'}%</strong>
                </span>
              </div>
            )}
          </div>
          <div className="h-64 w-full">
            {!analytics?.has_road_area ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900/40 rounded-lg border border-dashed border-slate-700/60">
                <span className="material-symbols-outlined text-[32px] text-amber-400 mb-2">square_foot</span>
                <div className="text-xs font-bold text-slate-200 font-mono uppercase mb-1">
                  Road Measurement Polygon Required
                </div>
                <p className="text-[11px] text-slate-400 max-w-sm mb-3">
                  Traffic density (veh/km²) and road occupancy (%) require defining a calibrated road boundary polygon on the ground plane.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/video-intelligence/projects/${projectId}/videos/${videoId}/setup`)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[15px]">draw</span>
                  <span>Define Road Measurement Area</span>
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="time" stroke="#888888" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#888888" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#06b6d4" fontSize={11} unit="%" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '12px' }}
                    formatter={(val: any, name: any) => {
                      if (name === 'Road Occupancy (%)') return [`${val}%`, name];
                      return [`${val} veh/km²`, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="density_veh_sqkm"
                    name="Density (veh/km²)"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="road_occupancy_percent"
                    name="Road Occupancy (%)"
                    stroke="#06b6d4"
                    strokeWidth={1.8}
                    strokeDasharray="4 2"
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          {analytics?.has_road_area && (
            <div className="mt-2 text-[10px] text-on-surface-variant font-mono flex items-center justify-between border-t border-outline-variant/40 pt-1.5">
              <span>Ground reference: Bottom-center bbox inside road polygon</span>
              <span>Footprints: IRC standards ({analytics.density_stats?.region_name || 'Roadway'})</span>
            </div>
          )}
        </div>


        {/* GRAPH 4: Vehicle Classification (Unique Track IDs) */}
        <div className="p-4 rounded-xl bg-surface border border-outline-variant flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-outline-variant pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-400 text-[18px]">pie_chart</span>
              <div className="text-xs font-bold text-on-surface font-mono uppercase">
                Graph 4: Vehicle Classification
              </div>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">Unique Vehicles per Class</span>
          </div>
          <div className="h-64 w-full">
            {classChartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-on-surface-variant text-xs font-mono">
                No vehicle classes detected.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} />
                  <YAxis stroke="#888888" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '12px' }}
                    formatter={(val: any) => [`${val} unique vehicles`, 'Count']}
                  />
                  <Bar dataKey="count" name="Unique Vehicles" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* SECTION C: Trajectory Table */}
      <div className="p-4 rounded-xl bg-surface border border-outline-variant flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-outline-variant pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">table_rows</span>
              <h2 className="text-sm font-bold text-on-surface font-mono uppercase">
                Section C: Trajectory Observations
              </h2>
            </div>
            <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
              Total {totalPoints.toLocaleString()} observations | Showing page {page + 1} of {Math.max(1, Math.ceil(totalPoints / pageSize))}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search by Track ID */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-slate-400">search</span>
              <input
                type="text"
                placeholder="Search Track ID..."
                value={searchTrackId}
                onChange={(e) => {
                  setSearchTrackId(e.target.value);
                  setPage(0);
                }}
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary w-40"
              />
            </div>

            {/* Filter by Vehicle Class */}
            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                setPage(0);
              }}
              className="py-1.5 px-3 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-200 focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="">All Classes</option>
              <option value="FOUR-WHEELER">Four-Wheeler</option>
              <option value="PEDESTRIAN">Pedestrian</option>
              <option value="BUS">Bus</option>
              <option value="TWO-WHEELER">Two-Wheeler</option>
              <option value="TRUCK">Truck</option>
            </select>

            {/* Clear Filters Button */}
            {(searchTrackId || filterClass) && (
              <button
                onClick={() => {
                  setSearchTrackId('');
                  setFilterClass('');
                  setPage(0);
                }}
                className="px-2.5 py-1.5 border border-slate-700 hover:bg-slate-800 rounded text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
                title="Reset Filters"
              >
                Clear
              </button>
            )}

            {/* Download CSV */}
            <a
              href={getTrajectoriesCsvUrl(videoId!)}
              download={`trajectories_${video?.title || videoId}.csv`}
              className="px-3.5 py-1.5 border border-outline-variant hover:bg-surface-container rounded text-xs font-mono text-on-surface transition-colors flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
            >
              <span className="material-symbols-outlined text-[16px]">table_view</span>
              <span>Download CSV</span>
            </a>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-800 shadow-inner">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="sticky top-0 bg-slate-950 text-slate-300 border-b border-slate-700/80">
                <th
                  onClick={() => toggleSort('timestamp_s')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  Timestamp (s) {sortBy === 'timestamp_s' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => toggleSort('track_id')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  Track ID {sortBy === 'track_id' && (sortAsc ? '▲' : '▼')}
                </th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Vehicle Class</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Image (X, Y)</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Ground (X, Y)</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Geographic (Lat, Lon)</th>
                <th
                  onClick={() => toggleSort('speed_kmh')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  Speed (km/h) {sortBy === 'speed_kmh' && (sortAsc ? '▲' : '▼')}
                </th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedPoints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    No trajectory points match the current filters.
                  </td>
                </tr>
              ) : (
                sortedPoints.map((pt, idx) => {
                  const isSelected = selectedPoint?.id === pt.id;
                  const rowZebra = idx % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-850/20';

                  return (
                    <tr
                      key={pt.id}
                      className={`border-b border-slate-800/60 transition-colors hover:bg-blue-950/20 ${rowZebra} ${
                        isSelected ? 'bg-blue-900/30 border-l-2 border-l-primary font-medium text-white' : 'text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-slate-200">{pt.timestamp_s.toFixed(2)}s</td>
                      <td className="py-2.5 px-3 font-bold text-slate-100">#{pt.track_id}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-block ${getClassBadgeStyle(pt.vehicle_class)}`}>
                          {pt.vehicle_class}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {pt.image_x}, {pt.image_y}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {pt.ground_x_m !== null && pt.ground_y_m !== null
                          ? `${pt.ground_x_m.toFixed(2)}m, ${pt.ground_y_m.toFixed(2)}m`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {pt.latitude !== null && pt.longitude !== null
                          ? `${pt.latitude.toFixed(6)}, ${pt.longitude.toFixed(6)}`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {pt.speed_kmh === null || pt.speed_kmh === undefined ? (
                          <span className="text-slate-500 text-[11px]">—</span>
                        ) : pt.speed_kmh === 0 ? (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px]">
                            0.0 km/h (Stopped)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[11px] font-semibold">
                            {pt.speed_kmh.toFixed(1)} km/h
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleOpenInspection(pt)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-primary hover:text-white rounded text-[11px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1 text-slate-300"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between border-t border-outline-variant pt-3">
          <span className="text-[11px] font-mono text-on-surface-variant">
            Page {page + 1} of {Math.max(1, Math.ceil(totalPoints / pageSize))} ({totalPoints.toLocaleString()} total points)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 border border-outline-variant rounded text-xs text-on-surface disabled:opacity-40 hover:bg-surface-container transition-colors cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => ((p + 1) * pageSize < totalPoints ? p + 1 : p))}
              disabled={(page + 1) * pageSize >= totalPoints}
              className="px-3 py-1 border border-outline-variant rounded text-xs text-on-surface disabled:opacity-40 hover:bg-surface-container transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* FRAME INSPECTION MODAL (TASK 4) */}
      {inspectingPoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[20px]">center_focus_strong</span>
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase">
                    Observation #{inspectingPoint.id} • Track #{inspectingPoint.track_id} ({inspectingPoint.vehicle_class})
                  </h3>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Frame #{inspectingPoint.frame_idx} • Timestamp {inspectingPoint.timestamp_s.toFixed(2)}s
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectingPoint(null)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex flex-col gap-4">
              {/* Frame Viewer */}
              <div className="relative w-full aspect-video max-h-[380px] bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
                {isFrameLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 z-10">
                    <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
                  </div>
                )}
                <img
                  src={getObservationFrameUrl(inspectingPoint.id)}
                  alt={`Observation ${inspectingPoint.id}`}
                  className="w-full h-full object-contain"
                  onLoad={() => setIsFrameLoading(false)}
                  onError={() => setIsFrameLoading(false)}
                />
              </div>

              {/* Observation Telemetry Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Track ID</div>
                  <div className="text-sm font-bold text-white mt-0.5">#{inspectingPoint.track_id}</div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Class</div>
                  <div className="mt-0.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block ${getClassBadgeStyle(inspectingPoint.vehicle_class)}`}>
                      {inspectingPoint.vehicle_class}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Confidence</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">
                    {inspectingPoint.confidence ? `${(inspectingPoint.confidence * 100).toFixed(1)}%` : '—'}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Calibrated Speed</div>
                  <div className="text-sm font-bold text-cyan-400 mt-0.5">
                    {inspectingPoint.speed_kmh !== null ? `${inspectingPoint.speed_kmh.toFixed(1)} km/h` : 'N/A'}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Image Coordinates</div>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5">
                    X: {inspectingPoint.image_x}, Y: {inspectingPoint.image_y}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Ground Coordinates</div>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5">
                    {inspectingPoint.ground_x_m !== null && inspectingPoint.ground_y_m !== null
                      ? `X: ${inspectingPoint.ground_x_m.toFixed(2)}m, Y: ${inspectingPoint.ground_y_m.toFixed(2)}m`
                      : 'Uncalibrated'}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 col-span-2">
                  <div className="text-[10px] text-slate-400 uppercase">Geographic (WGS84)</div>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5">
                    {inspectingPoint.latitude !== null && inspectingPoint.longitude !== null
                      ? `Lat: ${inspectingPoint.latitude.toFixed(6)}, Lon: ${inspectingPoint.longitude.toFixed(6)}`
                      : 'Uncalibrated'}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/80">
              <button
                onClick={() => setInspectingPoint(null)}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded text-xs font-mono text-slate-300 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handleJumpToTimestamp(inspectingPoint.timestamp_s)}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded text-xs font-bold font-mono transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span className="material-symbols-outlined text-[16px]">play_circle</span>
                <span>Jump Video to Timestamp ({inspectingPoint.timestamp_s.toFixed(2)}s)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
