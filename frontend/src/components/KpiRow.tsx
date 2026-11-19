import React from 'react';

interface KpiRowProps {
  totalVehicles?: number;
  avgSpeed?: number;
}

export const KpiRow: React.FC<KpiRowProps> = ({ totalVehicles, avgSpeed }) => {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* TOTAL VEHICLES TRACKED */}
      <div className="rounded border border-outline-variant bg-surface p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">directions_car</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface">
              Total Vehicles Tracked
            </span>
          </div>
          <span className="px-1.5 py-0.2 rounded border border-outline-variant bg-surface-container-low text-[10px] font-mono text-on-surface-variant uppercase">
            Cumulative
          </span>
        </div>

        <div className="flex items-baseline gap-2 my-2">
          <span className="text-2xl font-bold font-mono text-primary">
            {totalVehicles !== undefined && totalVehicles !== null && Number.isFinite(totalVehicles)
              ? totalVehicles.toLocaleString()
              : '--'}
          </span>
          <span className="text-xs text-on-surface-variant font-mono">
            confirmed trajectories
          </span>
        </div>

        <div className="text-[11px] text-on-surface-variant flex items-center gap-1.5 pt-1.5 border-t border-outline-variant/50">
          <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
          <span>
            {totalVehicles !== undefined && totalVehicles !== null && Number.isFinite(totalVehicles)
              ? 'Telemetry logs verified from backend trajectory database'
              : 'No trajectory dataset is presently loaded'}
          </span>
        </div>
      </div>

      {/* AVERAGE SPEED */}
      <div className="rounded border border-outline-variant bg-surface p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-success">speed</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface">
              Correlative Benchmark Velocity
            </span>
          </div>
          <span className="px-1.5 py-0.2 rounded border border-outline-variant bg-surface-container-low text-[10px] font-mono text-on-surface-variant uppercase">
            Derived
          </span>
        </div>

        <div className="flex items-baseline gap-2 my-2">
          <span className="text-2xl font-bold font-mono text-on-surface">
            {avgSpeed !== undefined && avgSpeed !== null && Number.isFinite(avgSpeed)
              ? avgSpeed.toFixed(1)
              : '--'}
          </span>
          <span className="text-xs text-on-surface-variant font-mono">
            km/h
          </span>
        </div>

        <div className="text-[11px] text-on-surface-variant flex items-center gap-1.5 pt-1.5 border-t border-outline-variant/50">
          <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
          <span>Requires 4-point homography calibration for physical roadway speed</span>
        </div>
      </div>
    </section>
  );
};
