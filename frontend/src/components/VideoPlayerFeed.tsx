import React, { useCallback, useEffect, useState } from 'react';
import { API_ORIGIN } from '../services/trafficApi';
import { fetchLatestCompletedVideo, type VideoSession } from '../services/videoApi';

interface VideoPlayerFeedProps {
  onOpenTrafficMonitor: () => void;
}

const categoryLabels: Array<[string, string]> = [
  ['TWO-WHEELER', 'Two-wheelers'],
  ['FOUR-WHEELER', 'Four-wheelers'],
  ['BUS', 'Buses'],
  ['TRUCK', 'Trucks'],
  ['BICYCLE', 'Bicycles'],
];

const loadErrorMessage = (error: unknown) => (
  typeof error === 'object'
    && error !== null
    && 'response' in error
    && (error as { response?: { status?: number } }).response?.status === 404
    ? 'No completed annotated recording is available yet.'
    : 'Unable to load the annotated recording. Check that the backend is running.'
);

export const VideoPlayerFeed: React.FC<VideoPlayerFeedProps> = ({ onOpenTrafficMonitor }) => {
  const [session, setSession] = useState<VideoSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLatest = useCallback(async () => {
    try {
      setSession(await fetchLatestCompletedVideo());
      setError('');
    } catch (requestError) {
      setSession(null);
      setError(loadErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchLatestCompletedVideo()
      .then((latest) => {
        if (active) {
          setSession(latest);
          setError('');
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setSession(null);
          setError(loadErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const refresh = () => {
    setLoading(true);
    void loadLatest();
  };

  const summary = session?.summary;
  const categoryCounts = summary?.category_counts || session?.category_counts || {};
  const videoUrl = session?.exports?.annotated_video
    ? `${API_ORIGIN}${session.exports.annotated_video}`
    : '';

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg font-bold text-on-surface">Annotated CCTV Recording</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Processed recording with vehicle detection boxes and a final count summary. This is recorded footage, not a live feed.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={refresh}
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
            Process another video
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant/20 bg-black shadow-md">
        {videoUrl ? (
          <video
            key={session?.session_id}
            src={videoUrl}
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="aspect-video max-h-[72vh] w-full bg-black object-contain"
            aria-label={`Annotated recording ${summary?.video_filename || session?.video_name || ''}`}
          />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl">video_file</span>
            <p>{loading ? 'Loading the latest annotated recording…' : error}</p>
            {!loading && (
              <button
                type="button"
                onClick={onOpenTrafficMonitor}
                className="rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container"
              >
                Open video processing
              </button>
            )}
          </div>
        )}
      </div>

      {session && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
          <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-headline-md font-semibold text-on-surface">Detected Category Counts</h2>
              <span className="text-xs text-on-surface-variant">
                {summary?.video_filename || session.video_name || 'Recorded video'} · {session.status}
                {summary?.is_partial ? ' · partial result' : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {categoryLabels.map(([category, label]) => (
                <div key={category} className="rounded-lg bg-surface-container p-3">
                  <p className="text-xs text-on-surface-variant">{label}</p>
                  <p className="mt-1 text-2xl font-bold text-primary">
                    {categoryCounts[category] ?? 0}
                  </p>
                </div>
              ))}
              <div className="rounded-lg bg-surface-container p-3">
                <p className="text-xs text-on-surface-variant">Total motor vehicles</p>
                <p className="mt-1 text-2xl font-bold text-primary">
                  {summary?.total_motor_vehicles ?? '--'}
                </p>
              </div>
              <div className="rounded-lg bg-surface-container p-3">
                <p className="text-xs text-on-surface-variant">Pedestrians</p>
                <p className="mt-1 text-2xl font-bold text-on-surface">
                  {summary?.pedestrians ?? categoryCounts.PEDESTRIAN ?? '--'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-on-surface-variant">
              Three-wheelers are not supported by the configured detector; a displayed zero is not a verified absence.
            </p>
          </section>

          <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
            <h2 className="font-headline-md font-semibold text-on-surface">Vehicle Speed</h2>
            <p className="mt-2 text-2xl font-bold text-on-surface-variant">
              {summary?.speed_kmh ?? 'Not measured'}
              {summary?.speed_kmh !== null && summary?.speed_kmh !== undefined ? ' km/h' : ''}
            </p>
            <p className="mt-2 text-sm text-on-surface-variant">
              {summary?.speed_note || 'Physical speed is not calculated for this recording.'}
            </p>
          </section>
        </div>
      )}
    </section>
  );
};
