import React, { useCallback, useEffect, useState } from 'react';
import { API_ORIGIN } from '../services/trafficApi';
import {
  fetchAnnotatedRecordings,
  type AnnotatedRecording,
} from '../services/videoApi';

interface VideoPlayerFeedProps {
  onOpenTrafficMonitor: () => void;
}

const categoryLabels: Array<[string, string]> = [
  ['TWO-WHEELER', 'Two-wheelers'],
  ['THREE-WHEELER', 'Three-wheelers'],
  ['FOUR-WHEELER', 'Four-wheeler / car'],
  ['BUS', 'Buses'],
  ['TRUCK', 'Trucks'],
  ['BICYCLE', 'Bicycles'],
  ['OTHER', 'Other vehicles'],
];

function RecordingPlayer({ recording }: { recording: AnnotatedRecording }) {
  const [playbackState, setPlaybackState] = useState<'loading' | 'ready' | 'error'>(
    recording.available ? 'loading' : 'error',
  );
  const counts = recording.summary.category_counts;

  return (
    <article className="overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low shadow-md">
      <header className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <h2 className="font-headline-md font-semibold text-on-surface">
            {recording.display_name}
          </h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Recorded Annotated Footage · not a live camera
          </p>
        </div>
        {recording.status && (
          <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
            {recording.summary.is_partial ? 'Partial processing result' : recording.status}
          </span>
        )}
      </header>

      <div className="relative aspect-video bg-black">
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
            className="absolute inset-0 h-full w-full object-contain"
            aria-label={`${recording.display_name} recorded traffic footage`}
          />
        )}
        {playbackState !== 'ready' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-container-low px-6 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl">
              {playbackState === 'loading' ? 'hourglass_top' : 'video_file'}
            </span>
            <p className="text-sm">
              {recording.available
                ? playbackState === 'loading'
                  ? 'Loading video… playback starts automatically; use the controls if needed.'
                  : 'This annotated video could not be played.'
                : recording.error || 'Annotated video not available.'}
            </p>
          </div>
        )}
      </div>

      {recording.available && (
        <div className="space-y-3 p-4">
          <p className="text-xs text-on-surface-variant">
            {recording.summary.video_filename || 'Recorded video'}
            {recording.processing_job_id && ` · Job ${recording.processing_job_id}`}
            {recording.duration_seconds !== null && ` · ${recording.duration_seconds.toFixed(1)} s`}
            {recording.width && recording.height && ` · ${recording.width}×${recording.height}`}
            {recording.file_size_bytes !== null
              && ` · ${(recording.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`}
          </p>
          {counts && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {categoryLabels.map(([category, label]) => (
                <div key={category} className="rounded-lg bg-surface-container p-2.5">
                  <p className="text-xs text-on-surface-variant">{label}</p>
                  <p className="mt-1 font-semibold text-primary">
                    {counts[category] ?? 0}
                  </p>
                </div>
              ))}
              <div className="rounded-lg bg-surface-container p-2.5">
                <p className="text-xs text-on-surface-variant">Pedestrians (separate)</p>
                <p className="mt-1 font-semibold text-on-surface">
                  {recording.summary.pedestrians ?? counts.PEDESTRIAN ?? '--'}
                </p>
              </div>
              <div className="rounded-lg bg-surface-container p-2.5">
                <p className="text-xs text-on-surface-variant">Total vehicles</p>
                <p className="mt-1 font-semibold text-primary">
                  {recording.summary.total_vehicles_including_bicycle
                    ?? recording.summary.total_motor_vehicles
                    ?? '--'}
                </p>
              </div>
            </div>
          )}
          {recording.summary.speed_kmh == null && (
            <p className="text-xs text-on-surface-variant">
              Physical speed: not measured; calibrated ground-plane data is required.
            </p>
          )}
          {counts && (
            <p className="text-xs text-on-surface-variant">
              Counts are from this recorded processing job. Three-wheeler detection is unavailable with the configured COCO model, so zero does not establish absence.
            </p>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg font-bold text-on-surface">
            Processed Video Playback
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Two distinct annotated recordings. Live CCTV connection status is shown separately in Traffic Monitor.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError('');
              void loadRecordings();
            }}
            disabled={loading}
            className="rounded-lg border border-outline-variant/30 px-3 py-2 text-sm text-on-surface disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={onOpenTrafficMonitor}
            className="rounded-lg bg-primary-container px-3 py-2 text-sm font-semibold text-on-primary-container"
          >
            Open Traffic Monitor
          </button>
        </div>
      </div>

      {loading && recordings.length === 0 ? (
        <div className="flex aspect-video items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant">
          Loading annotated recordings…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-error/20 bg-surface-container-low p-8 text-center text-on-surface-variant">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadRecordings()}
            className="mt-4 rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container"
          >
            Retry
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
