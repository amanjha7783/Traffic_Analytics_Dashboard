import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
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
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
      {/* Main Chart (8 Cols) */}
      <div className="lg:col-span-8 rounded border border-outline-variant bg-surface p-4 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 border-b border-outline-variant pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">show_chart</span>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface">
                  Historical Trajectory Timeline
                </h2>
                <p className="text-[11px] font-mono text-on-surface-variant">
                  Vehicle detections mapped chronologically along source timestamps
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded border border-outline-variant bg-surface-container-low text-[10px] font-mono font-medium text-on-surface-variant">
              {points.length} SAMPLES
            </span>
          </div>
        </div>

        {points.length > 0 ? (
          <div className="w-full h-[320px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 10, right: 15, left: -15, bottom: 10 }}>
                <defs>
                  <linearGradient id="trajGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#315B8A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#315B8A" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--color-outline-variant)" opacity={0.5} />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }}
                  label={{ value: 'Source Timestamp (s)', position: 'insideBottom', offset: -5, fill: 'var(--color-on-surface-variant)', fontSize: 11 }} 
                />
                <YAxis 
                  allowDecimals={false} 
                  tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-outline)',
                    borderRadius: '4px',
                    color: 'var(--color-on-surface)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                  formatter={(val: any) => [`${val} Vehicles`, 'Tracked Count']}
                  labelFormatter={(t) => `Timestamp: ${t}s`}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#315B8A" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#trajGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40 mb-2">timeline</span>
            <p className="text-xs font-medium text-on-surface-variant">No trajectory observations available in this dataset.</p>
          </div>
        )}
      </div>

      {/* Metadata & Sensor Status Cards (4 Cols) */}
      <div className="lg:col-span-4 flex flex-col gap-3 justify-between">
        {[
          {
            title: 'Classification Mix',
            icon: 'commute',
            badge: 'UNAVAILABLE',
            badgeClass: 'bg-surface-container-low text-on-surface-variant border-outline-variant',
            detail: 'Raw trajectory file records lack validated category classifications. Real-time class identification requires the YOLO-based detector.',
          },
          {
            title: 'Ground Velocity',
            icon: 'speed',
            badge: 'CALIBRATION REQUIRED',
            badgeClass: 'bg-warning/15 text-warning border-warning/30',
            detail: 'Screen coordinate velocity is non-linear without planar homography matrix calibration against ground-truth surveyed control points.',
          },
          {
            title: 'Conflict Analysis',
            icon: 'warning',
            badge: 'UNAVAILABLE',
            badgeClass: 'bg-surface-container-low text-on-surface-variant border-outline-variant',
            detail: 'Collision time-to-closest-approach (TTC) requires vehicle footprint dimensions and synchronized camera geometry.',
          },
        ].map((item) => (
          <article 
            key={item.title} 
            className="rounded border border-outline-variant bg-surface p-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">{item.icon}</span>
                  <h3 className="text-xs font-semibold text-on-surface">{item.title}</h3>
                </div>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-medium uppercase border ${item.badgeClass}`}>
                  {item.badge}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
