import React, { useEffect, useState } from 'react';
import { API_ORIGIN } from '../services/trafficApi';
import { fetchLatestCompletedVideo, type VideoSession } from '../services/videoApi';

const reportExports: Array<[string, string]> = [
  ['count_summary', 'Category count summary (CSV)'],
  ['track_details', 'Confirmed track details (CSV)'],
  ['minute_counts', 'Minute-wise counts (CSV)'],
  ['processing_summary', 'Processing summary (JSON)'],
  ['annotated_video', 'Annotated video (MP4)'],
];

function requestError(error: unknown): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
    if (detail) return detail;
  }
  return error instanceof Error ? error.message : 'Unable to load the latest completed video report.';
}

export const ReportsView: React.FC = () => {
  const [session, setSession] = useState<VideoSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchLatestCompletedVideo()
      .then((result) => {
        if (active) setSession(result);
      })
      .catch((requestFailure: unknown) => {
        if (!active) return;
        const message = requestError(requestFailure);
        setError(message.includes('No completed annotated video')
          ? 'No completed video report is available yet.'
          : message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flex flex-col gap-space-lg">
      <header className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-space-lg">
        <h1 className="font-headline-lg font-bold text-on-surface">Traffic Reports</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Download exports from the latest completed recorded-video processing job. No incident totals are fabricated.
        </p>
      </header>
      <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-space-lg">
        <h2 className="font-headline-md font-semibold text-on-surface">Recorded Video Exports</h2>
        {loading ? (
          <p className="mt-2 text-sm text-on-surface-variant">Loading completed report…</p>
        ) : error ? (
          <p role="status" className="mt-2 text-sm text-on-surface-variant">{error}</p>
        ) : session ? (
          <>
            <p className="mt-2 text-sm text-on-surface-variant">
              {session.video_name || session.summary?.video_filename || 'Recorded video'}
              {' · Job '}
              {session.session_id}
              {session.summary?.total_motor_vehicles !== undefined
                && ` · ${session.summary.total_motor_vehicles} unique motor vehicles`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {reportExports.map(([exportName, label]) => {
                const url = session.exports?.[exportName];
                return url ? (
                  <a
                    key={exportName}
                    href={`${API_ORIGIN}${url}`}
                    download
                    className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface hover:border-primary"
                  >
                    {label}
                  </a>
                ) : null;
              })}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-on-surface-variant">No completed report is available yet.</p>
        )}
        <p className="mt-3 text-xs text-amber-300">
          Vehicle conflict/PET alerts and signal-cycle efficiency are not implemented telemetry and are intentionally unavailable.
        </p>
      </div>
    </section>
  );
};
