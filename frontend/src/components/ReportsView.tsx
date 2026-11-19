import React, { useEffect, useState } from 'react';
import { API_ORIGIN } from '../services/trafficApi';
import { fetchLatestCompletedVideo, type VideoSession } from '../services/videoApi';

const reportExports: Array<{ key: string; label: string; format: string; icon: string; desc: string }> = [
  { key: 'count_summary', label: 'Category Count Summary', format: 'CSV', icon: 'table_view', desc: 'Aggregated vehicle taxonomy classification counts' },
  { key: 'track_details', label: 'Confirmed Track Details', format: 'CSV', icon: 'timeline', desc: 'Full trajectory timestamps, centroids, and tracking IDs' },
  { key: 'minute_counts', label: 'Minute-wise Traffic Counts', format: 'CSV', icon: 'schedule', desc: 'Granular 60-second interval volume histogram' },
  { key: 'processing_summary', label: 'Processing Telemetry Summary', format: 'JSON', icon: 'code', desc: 'Hardware, detector confidence, and runtime parameters' },
  { key: 'annotated_video', label: 'Annotated Video Footage', format: 'MP4', icon: 'movie', desc: 'Full resolution bounding box overlay recording' },
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
    <section className="flex flex-col gap-4 w-full">
      {/* Header Toolbar */}
      <div className="p-3.5 rounded border border-outline-variant bg-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[18px]">description</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-on-surface">
                Traffic Operations Audit & Telemetry Export
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-surface-container-high text-on-surface-variant border border-outline-variant">
                AUDITED LOGS
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Export verified raw telemetry, time-series intervals, and rendered MP4 video from completed CV inference jobs
            </p>
          </div>
        </div>

        {session && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded border border-outline-variant bg-surface-container-low font-mono text-xs text-on-surface-variant">
            <span>Job ID:</span>
            <span className="text-on-surface font-semibold truncate max-w-[140px]" title={session.session_id}>
              {session.session_id.slice(0, 10)}...
            </span>
          </div>
        )}
      </div>

      {/* Main Exports Container */}
      <div className="p-4 rounded border border-outline-variant bg-surface flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-outline-variant pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface">
              Latest Completed Inference Artifacts
            </span>
            {session && (
              <span className="text-[10px] font-mono text-on-surface-variant">
                ({session.video_name || session.summary?.video_filename || 'Recorded Video'} &bull; {session.summary?.total_motor_vehicles ?? 0} vehicles)
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant gap-2">
            <span className="material-symbols-outlined text-[24px] text-primary animate-spin">sync</span>
            <p className="text-xs font-medium text-on-surface">Querying completed export repository...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded border border-outline-variant bg-surface-container-low text-center flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-[28px] text-on-surface-variant/40 mb-1.5">description</span>
            <p className="text-xs font-medium text-on-surface">{error}</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Run an offline video inference job in Traffic Monitor to produce downloadable artifacts.</p>
          </div>
        ) : session ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {reportExports.map((item) => {
              const url = session.exports?.[item.key];
              return (
                <div 
                  key={item.key}
                  className="rounded border border-outline-variant bg-surface-container-low p-3.5 flex flex-col justify-between hover:border-primary/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] text-primary">{item.icon}</span>
                        <h3 className="text-xs font-semibold text-on-surface">{item.label}</h3>
                      </div>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium uppercase bg-surface text-on-surface-variant border border-outline-variant">
                        {item.format}
                      </span>
                    </div>

                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-outline-variant flex items-center justify-between">
                    {url ? (
                      <a
                        href={`${API_ORIGIN}${url}`}
                        download
                        className="w-full py-1.5 px-3 rounded bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        <span>Download {item.format}</span>
                      </a>
                    ) : (
                      <span className="w-full py-1 px-2 rounded bg-surface text-on-surface-variant/50 text-[10px] font-mono text-center border border-outline-variant">
                        Artifact Not Generated
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant">No completed report is available yet.</p>
        )}

        <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low text-[10px] font-mono text-on-surface-variant flex items-center gap-2">
          <span className="material-symbols-outlined text-warning text-[16px]">info</span>
          <span>Notice: Post-encroachment time (PET) and signal-cycle efficiency metrics require specialized sensor controllers and are omitted.</span>
        </div>
      </div>
    </section>
  );
};
