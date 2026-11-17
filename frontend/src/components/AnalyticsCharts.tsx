import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface AnalyticsChartsProps {
  data?: Array<{ timestamp?: number; count?: number }>;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ data = [] }) => {
  const points = data
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.count))
    .map((point) => ({
      time: Number(point.timestamp),
      count: Number(point.count),
    }));

  return (
    <section className="grid grid-cols-1 gap-space-md lg:grid-cols-2">
      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-space-md">
        <h2 className="font-headline-sm font-semibold text-on-surface">Historical Trajectory Counts</h2>
        <p className="mb-4 text-xs text-on-surface-variant">Counts from the backend trajectory file; not live CCTV detections.</p>
        {points.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" label={{ value: 'Source timestamp', position: 'insideBottom', offset: -8 }} />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#4cd7f6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-on-surface-variant">No trajectory observations are available.</p>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {[
          ['Vehicle class mix', 'Unavailable: the trajectory feed has no validated category counts.'],
          ['Calibrated speed trend', 'Unavailable: image-space motion is not physical speed.'],
          ['Conflict / occupancy metrics', 'Unavailable: no calibrated footprint or conflict-event data.'],
        ].map(([title, detail]) => (
          <article key={title} className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-space-md">
            <h3 className="font-headline-sm font-semibold text-on-surface">{title}</h3>
            <p className="mt-2 text-sm text-on-surface-variant">{detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
};
