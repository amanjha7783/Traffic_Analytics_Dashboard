import React, { useState, useEffect, useRef } from 'react';
import { StudioProject, StudioVideo, CameraComparisonItem } from '../../types/videoIntelligence';
import { compareCameras, getVideoStreamUrl, getAnnotatedVideoStreamUrl } from '../../services/videoIntelligenceApi';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface MultiCameraComparisonProps {
  project: StudioProject;
  videos: StudioVideo[];
}

const CAMERA_COLORS = ['#315B8A', '#16845B', '#C58A24', '#C44848'];

export const MultiCameraComparison: React.FC<MultiCameraComparisonProps> = ({
  project,
  videos,
}) => {
  // Select up to 4 videos
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>(() =>
    videos.slice(0, Math.min(2, videos.length)).map((v) => v.id)
  );

  const [layout, setLayout] = useState<'2-col' | '3-col' | '4-grid'>('2-col');
  const [comparisonData, setComparisonData] = useState<CameraComparisonItem[]>([]);
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [masterTime, setMasterTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [useAnnotated, setUseAnnotated] = useState(true);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    if (selectedVideoIds.length >= 2) {
      compareCameras(project.id, selectedVideoIds)
        .then((res) => setComparisonData(res.cameras || []))
        .catch((err) => console.error('Failed to load comparison data:', err));
    }
  }, [project.id, selectedVideoIds]);

  const toggleSelectVideo = (id: string) => {
    if (selectedVideoIds.includes(id)) {
      if (selectedVideoIds.length > 2) {
        setSelectedVideoIds(selectedVideoIds.filter((v) => v !== id));
      }
    } else {
      if (selectedVideoIds.length < 4) {
        setSelectedVideoIds([...selectedVideoIds, id]);
      }
    }
  };

  // Synchronized Playback Handlers
  const handlePlayAll = () => {
    setIsPlayingAll(true);
    selectedVideoIds.forEach((id) => {
      const vidEl = videoRefs.current[id];
      if (vidEl) vidEl.play();
    });
  };

  const handlePauseAll = () => {
    setIsPlayingAll(false);
    selectedVideoIds.forEach((id) => {
      const vidEl = videoRefs.current[id];
      if (vidEl) vidEl.pause();
    });
  };

  const handleMasterSeek = (t: number) => {
    setMasterTime(t);
    selectedVideoIds.forEach((id) => {
      const vidEl = videoRefs.current[id];
      const offset = offsets[id] || 0;
      if (vidEl) {
        vidEl.currentTime = Math.max(0, t + offset);
      }
    });
  };

  const handleSpeedChange = (spd: number) => {
    setPlaybackSpeed(spd);
    selectedVideoIds.forEach((id) => {
      const vidEl = videoRefs.current[id];
      if (vidEl) vidEl.playbackRate = spd;
    });
  };

  const handleOffsetChange = (id: string, offsetSec: number) => {
    setOffsets((prev) => ({ ...prev, [id]: offsetSec }));
    const vidEl = videoRefs.current[id];
    if (vidEl) {
      vidEl.currentTime = Math.max(0, masterTime + offsetSec);
    }
  };

  // Aligned chart timeline data
  const maxTimelineLen = Math.max(...comparisonData.map((c) => c.timeline.length), 0);
  const mergedTimeline = [];
  for (let i = 0; i < maxTimelineLen; i++) {
    const point: any = { time: i * 2 };
    comparisonData.forEach((cam, idx) => {
      const entry = cam.timeline[i];
      point[`${cam.camera_id}_count`] = entry ? entry.vehicle_count : null;
      point[`${cam.camera_id}_speed`] = entry ? entry.avg_speed_kmh : null;
      point[`${cam.camera_id}_occupancy`] = entry ? entry.occupancy_percent : null;
    });
    mergedTimeline.push(point);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Control Header */}
      <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-primary/10 text-primary flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">view_column</span>
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-on-surface">Multi-Camera Synchronized Video & Telemetry Comparison</h2>
            <span className="text-xs text-on-surface-variant font-mono">
              Compare 2 to 4 camera streams with time offset alignment (Δt)
            </span>
          </div>
        </div>

        {/* Camera Selector Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {videos.map((vid) => {
            const isSelected = selectedVideoIds.includes(vid.id);
            return (
              <button
                key={vid.id}
                onClick={() => toggleSelectVideo(vid.id)}
                className={`px-3 py-1 rounded text-xs font-mono font-semibold border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-surface-container-high text-on-surface-variant border-outline-variant hover:text-on-surface'
                }`}
              >
                {vid.camera_id} • {vid.title.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Master Synchronized Controller */}
      <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col gap-3 shadow-subtle">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={isPlayingAll ? handlePauseAll : handlePlayAll}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-white font-semibold text-xs hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isPlayingAll ? 'pause' : 'play_arrow'}
              </span>
              <span>{isPlayingAll ? 'Pause All' : 'Play All'}</span>
            </button>

            <button
              onClick={() => handleMasterSeek(0)}
              className="px-2.5 py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-mono"
            >
              Reset to 0s
            </button>

            <button
              onClick={() => setUseAnnotated(!useAnnotated)}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold border transition-colors ${
                useAnnotated ? 'bg-primary/10 text-primary border-primary/30' : 'bg-surface text-on-surface border-outline-variant'
              }`}
            >
              {useAnnotated ? 'Overlays ON' : 'Raw Feeds'}
            </button>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <span>Rate:</span>
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

        {/* Master Scrubbing Bar */}
        <div className="flex items-center gap-3 pt-2 border-t border-outline-variant/60">
          <span className="font-mono text-xs text-on-surface-variant shrink-0">Master Time:</span>
          <input
            type="range"
            min="0"
            max={30}
            step="0.1"
            value={masterTime}
            onChange={(e) => handleMasterSeek(parseFloat(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
          <span className="font-mono text-xs text-on-surface font-bold shrink-0">
            {masterTime.toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Synchronized Video Grid */}
      <div className={`grid gap-4 ${
        selectedVideoIds.length === 2
          ? 'grid-cols-1 md:grid-cols-2'
          : selectedVideoIds.length === 3
          ? 'grid-cols-1 md:grid-cols-3'
          : 'grid-cols-1 md:grid-cols-2'
      }`}>
        {selectedVideoIds.map((vidId, idx) => {
          const vid = videos.find((v) => v.id === vidId);
          if (!vid) return null;
          const offset = offsets[vidId] || 0;

          return (
            <div
              key={vidId}
              className="p-3.5 rounded bg-surface border border-outline-variant flex flex-col gap-2.5 shadow-subtle"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CAMERA_COLORS[idx % CAMERA_COLORS.length] }}
                  />
                  <span className="font-bold text-xs font-mono text-on-surface">{vid.camera_id}</span>
                  <span className="text-xs text-on-surface-variant truncate">{vid.title}</span>
                </div>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/30">
                  {vid.status}
                </span>
              </div>

              {/* Video Element */}
              <div className="relative aspect-video bg-black rounded overflow-hidden border border-outline-variant flex items-center justify-center">
                <video
                  ref={(el) => (videoRefs.current[vidId] = el)}
                  src={useAnnotated ? getAnnotatedVideoStreamUrl(vidId) : getVideoStreamUrl(vidId)}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Camera Time Offset (Δt) Control */}
              <div className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant/60 text-xs font-mono">
                <span className="text-on-surface-variant">Time Offset (Δt):</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOffsetChange(vidId, Math.round((offset - 0.5) * 10) / 10)}
                    className="px-1.5 py-0.5 rounded bg-surface border border-outline-variant hover:bg-surface-container"
                  >
                    -0.5s
                  </button>
                  <span className="font-bold text-primary px-1">{offset >= 0 ? `+${offset}` : offset}s</span>
                  <button
                    onClick={() => handleOffsetChange(vidId, Math.round((offset + 0.5) * 10) / 10)}
                    className="px-1.5 py-0.5 rounded bg-surface border border-outline-variant hover:bg-surface-container"
                  >
                    +0.5s
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparative Analytics Below Players */}
      <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col gap-4 shadow-subtle">
        <h3 className="text-xs font-semibold text-on-surface uppercase font-mono tracking-wider">
          Side-by-Side Comparative Flow & Velocity Analytics
        </h3>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedTimeline}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="time" unit="s" stroke="#888888" fontSize={11} />
              <YAxis stroke="#888888" fontSize={11} label={{ value: 'Vehicles / Speed', angle: -90, position: 'insideLeft', fontSize: 10 }} />
              <Tooltip />
              <Legend />
              {comparisonData.map((cam, idx) => (
                <Line
                  key={cam.camera_id}
                  type="monotone"
                  dataKey={`${cam.camera_id}_count`}
                  name={`${cam.camera_id} Volume`}
                  stroke={CAMERA_COLORS[idx % CAMERA_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Comparative Summary Table */}
        <div className="border border-outline-variant rounded overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase text-on-surface-variant">
              <tr>
                <th className="p-2.5">Camera Source</th>
                <th className="p-2.5">Total Detected</th>
                <th className="p-2.5">Average Speed</th>
                <th className="p-2.5">Peak Speed</th>
                <th className="p-2.5">Calibration RMSE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {comparisonData.map((cam, idx) => (
                <tr key={cam.camera_id} className="hover:bg-surface-container-high/60">
                  <td className="p-2.5 font-bold flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: CAMERA_COLORS[idx % CAMERA_COLORS.length] }}
                    />
                    <span>{cam.camera_id} • {cam.title}</span>
                  </td>
                  <td className="p-2.5 font-bold text-primary">
                    {cam.summary.total_vehicles_detected || '—'}
                  </td>
                  <td className="p-2.5">{cam.summary.avg_speed_kmh ? `${cam.summary.avg_speed_kmh} km/h` : '—'}</td>
                  <td className="p-2.5">{cam.summary.max_speed_kmh ? `${cam.summary.max_speed_kmh} km/h` : '—'}</td>
                  <td className="p-2.5 font-semibold text-success">
                    {cam.rmse_m !== null && cam.rmse_m !== undefined ? `${cam.rmse_m}m` : 'Uncalibrated'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
