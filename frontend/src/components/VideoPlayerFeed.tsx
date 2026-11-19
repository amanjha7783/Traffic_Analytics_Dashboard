import React, { useCallback, useEffect, useState } from 'react';
import { API_ORIGIN } from '../services/trafficApi';
import {
  fetchAnnotatedRecordings,
  type AnnotatedRecording,
} from '../services/videoApi';

interface VideoPlayerFeedProps {
  onOpenTrafficMonitor: () => void;
}

const CATEGORIES: Array<{ key: string; label: string; icon: string }> = [
  { key: 'TWO-WHEELER', label: '2-Wheeler (Motorcycle/Scooter)', icon: 'two_wheeler' },
  { key: 'THREE-WHEELER', label: '3-Wheeler (Auto-Rickshaw)', icon: 'electric_rickshaw' },
  { key: 'FOUR-WHEELER', label: '4-Wheeler (Passenger Car)', icon: 'directions_car' },
  { key: 'BUS', label: 'Transit Bus', icon: 'directions_bus' },
  { key: 'TRUCK', label: 'Heavy Truck / Commercial', icon: 'local_shipping' },
  { key: 'BICYCLE', label: 'Non-Motorized Bicycle', icon: 'pedal_bike' },
  { key: 'OTHER', label: 'Other Classified', icon: 'commute' },
];

function RecordingPlayer({ recording }: { recording: AnnotatedRecording }) {
  const [playbackState, setPlaybackState] = useState<'loading' | 'ready' | 'error'>(
    recording.available ? 'loading' : 'error',
  );
  const counts = recording.summary.category_counts || {};

  return (
    <article className="rounded border border-outline-variant bg-surface flex flex-col overflow-hidden">
      {/* Video Stream Header */}
      <header className="px-4 py-2.5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-success shrink-0" />
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 className="text-xs font-semibold text-on-surface truncate">
              {recording.display_name}
            </h2>
            <span className="text-[10px] font-mono text-on-surface-variant hidden sm:inline truncate">
              {recording.summary.video_filename || 'CCTV Feed'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {recording.status && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase border border-outline-variant bg-surface text-on-surface-variant">
              {recording.summary.is_partial ? 'Partial Dataset' : recording.status}
            </span>
          )}
        </div>
      </header>

      {/* Video Viewport */}
      <div className="relative aspect-video bg-black/90 flex items-center justify-center">
        {recording.available && recording.stream_url && (
          <video
            key={recording.recording_id}
            src={`${API_ORIGIN}${recording.stream_url}`}
            controls
            autoPlay
            muted
            playsInline
            preload="auto"
            onCanPlay={() => setPlaybackState('ready')}
            onPlay={() => setPlaybackState('ready')}
            onError={() => setPlaybackState('error')}
            className="h-full w-full object-contain"
            aria-label={`${recording.display_name} recorded traffic footage`}
          />
        )}
        {playbackState !== 'ready' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-container-low/95 px-4 text-center">
            <span className="material-symbols-outlined text-[28px] text-primary">
              {playbackState === 'loading' ? 'hourglass_top' : 'videocam_off'}
            </span>
            <p className="text-xs font-medium text-on-surface">
              {recording.available
                ? playbackState === 'loading'
                  ? 'Loading annotated video stream...'
                  : 'Unable to stream recording from storage.'
                : recording.error || 'Annotated video feed unavailable.'}
            </p>
          </div>
        )}
      </div>

      {/* Technical Telemetry Strip */}
      <div className="px-4 py-2 bg-surface-container-low border-b border-outline-variant grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-on-surface-variant">
        <div>
          <span className="text-on-surface-variant/70">Duration: </span>
          <span className="text-on-surface font-medium">
            {recording.duration_seconds !== null ? `${recording.duration_seconds.toFixed(1)}s` : 'N/A'}
          </span>
        </div>
        <div>
          <span className="text-on-surface-variant/70">Resolution: </span>
          <span className="text-on-surface font-medium">
            {recording.width && recording.height ? `${recording.width}×${recording.height}` : 'N/A'}
          </span>
        </div>
        <div>
          <span className="text-on-surface-variant/70">File Size: </span>
          <span className="text-on-surface font-medium">
            {recording.file_size_bytes !== null ? `${(recording.file_size_bytes / (1024 * 1024)).toFixed(1)} MB` : 'N/A'}
          </span>
        </div>
        <div>
          <span className="text-on-surface-variant/70">Job ID: </span>
          <span className="text-on-surface font-medium truncate" title={recording.processing_job_id || ''}>
            {recording.processing_job_id ? recording.processing_job_id.slice(0, 10) : 'N/A'}
          </span>
        </div>
      </div>

      {/* Vehicle Classification Counters Table */}
      {recording.available && (
        <div className="p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase font-semibold text-on-surface-variant tracking-wider">
              Vehicle Classification Counts
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-on-surface-variant">Total Motor Vehicles:</span>
              <span className="font-mono text-xs font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                {recording.summary.total_vehicles_including_bicycle
                  ?? recording.summary.total_motor_vehicles
                  ?? 0}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CATEGORIES.map(({ key, label, icon }) => (
              <div
                key={key}
                className="p-2 rounded border border-outline-variant bg-surface-container-low flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant shrink-0">
                    {icon}
                  </span>
                  <span className="text-[11px] text-on-surface-variant truncate" title={label}>
                    {key.replace('-', ' ')}
                  </span>
                </div>
                <span className="font-mono text-xs font-semibold text-on-surface ml-2">
                  {counts[key] ?? 0}
                </span>
              </div>
            ))}

            {/* Pedestrians */}
            <div className="p-2 rounded border border-outline-variant bg-surface-container-low flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant shrink-0">
                  directions_walk
                </span>
                <span className="text-[11px] text-on-surface-variant truncate">
                  PEDESTRIANS
                </span>
              </div>
              <span className="font-mono text-xs font-semibold text-on-surface ml-2">
                {recording.summary.pedestrians ?? counts.PEDESTRIAN ?? 0}
              </span>
            </div>
          </div>

          {recording.summary.speed_kmh == null && (
            <div className="text-[10px] font-mono text-on-surface-variant flex items-center gap-1.5 pt-1 border-t border-outline-variant/50">
              <span className="material-symbols-outlined text-[14px] text-warning">info</span>
              <span>Physical road velocity requires 4-point homography plane calibration.</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export const VideoPlayerFeed: React.FC<VideoPlayerFeedProps> = ({ onOpenTrafficMonitor }) => {
  const [recordings, setRecordings] = useState<AnnotatedRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRecordings = useCallback(async () => {
    try {
      setRecordings(await fetchAnnotatedRecordings());
      setError('');
    } catch (requestError) {
      console.error('Unable to load annotated recordings', requestError);
      setError('Unable to load annotated recordings. Check that the backend is running.');
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAnnotatedRecordings()
      .then((result) => {
        if (active) {
          setRecordings(result);
          setError('');
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          console.error('Unable to load annotated recordings', requestError);
          setError('Unable to load annotated recordings. Check that the backend is running.');
          setRecordings([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flex flex-col gap-4">
      {/* Operational Toolbar */}
      <div className="p-3.5 rounded border border-outline-variant bg-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[18px]">videocam</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-on-surface">
                Synchronized CCTV Inferences
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-success/15 text-success border border-success/30">
                DUAL DETECTOR
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Dual-angle computer vision inference feeds with bounding box detections & vehicle class counts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError('');
              void loadRecordings();
            }}
            disabled={loading}
            className="px-3 py-1.5 rounded border border-outline-variant bg-surface-container-low hover:bg-surface-container text-xs font-medium text-on-surface transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{loading ? 'Refreshing…' : 'Refresh Feeds'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenTrafficMonitor}
            className="px-3 py-1.5 rounded bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">settings</span>
            <span>Configure Stream Ingest</span>
          </button>
        </div>
      </div>

      {loading && recordings.length === 0 ? (
        <div className="flex aspect-video max-h-96 items-center justify-center rounded border border-outline-variant bg-surface p-8 text-center text-on-surface-variant">
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-[28px] text-primary animate-spin">sync</span>
            <p className="text-xs font-medium text-on-surface">Querying annotated video streams...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded border border-danger/40 bg-surface p-6 text-center text-on-surface flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded bg-danger/10 border border-danger/30 flex items-center justify-center text-danger mb-2">
            <span className="material-symbols-outlined text-[22px]">error</span>
          </div>
          <p className="text-xs font-medium">{error}</p>
          <button
            type="button"
            onClick={() => void loadRecordings()}
            className="mt-3 px-3 py-1.5 rounded bg-primary text-white text-xs font-medium hover:bg-primary/90 cursor-pointer transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {recordings.map((recording) => (
            <RecordingPlayer key={recording.recording_id} recording={recording} />
          ))}
        </div>
      )}
    </section>
  );
};
