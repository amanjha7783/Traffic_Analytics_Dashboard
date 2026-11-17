import React from 'react';

interface KpiRowProps {
  totalVehicles?: number;
  avgSpeed?: number;
}

export const KpiRow: React.FC<KpiRowProps> = ({ totalVehicles, avgSpeed }) => {
  return (
    <section className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
      
      {/* VEHICLES DETECTED */}
      <div className="flex flex-col bg-surface-container-low p-space-md rounded-xl border border-outline-variant/20 shadow-sm">
        <span className="font-headline-sm text-on-surface font-semibold mb-2">Vehicles Detected</span>
        <div className="flex items-baseline gap-2">
          <span className="font-display-lg text-primary">
            {totalVehicles !== undefined && totalVehicles !== null && Number.isFinite(totalVehicles)
              ? totalVehicles
              : '--'}
          </span>
        </div>
        <span className="font-body-sm text-on-surface-variant mt-1">
          {totalVehicles !== undefined && totalVehicles !== null && Number.isFinite(totalVehicles)
            ? 'Historical trajectory-file records'
            : 'No vehicle-count data available'}
        </span>
      </div>

      {/* AVERAGE SPEED */}
      <div className="flex flex-col bg-surface-container-low p-space-md rounded-xl border border-outline-variant/20 shadow-sm">
        <span className="font-headline-sm text-on-surface font-semibold mb-2">Average Speed</span>
        <div className="flex items-baseline gap-2">
          <span className="font-display-lg text-primary">
            {avgSpeed !== undefined && avgSpeed !== null && Number.isFinite(avgSpeed)
              ? avgSpeed.toFixed(1)
              : '--'}
          </span>
          <span className="font-body-sm font-semibold text-on-surface-variant">km/h</span>
        </div>
        <span className="font-body-sm text-on-surface-variant mt-1">
          Historical trajectory data; not a calibrated live speed
        </span>
      </div>

    </section>
  );
};
