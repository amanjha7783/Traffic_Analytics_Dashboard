import React from 'react';

interface KpiRowProps {
  totalVehicles?: number;
  avgSpeed?: number;
  riskScore?: number;
  trafficDensity?: number;
}

export const KpiRow: React.FC<KpiRowProps> = ({
  totalVehicles,
  avgSpeed,
  riskScore,
  trafficDensity,
}) => {
  const getRiskLabel = (score?: number) => {
    if (score === undefined || score === null) return { label: 'Unavailable', color: 'text-on-surface-variant', bg: 'bg-surface-container-high text-on-surface-variant' };
    if (score < 40) return { label: 'Low', color: 'text-tertiary', bg: 'bg-tertiary-container text-on-tertiary-container' };
    if (score < 75) return { label: 'Medium', color: 'text-amber-500', bg: 'bg-amber-100 text-amber-800' };
    return { label: 'High', color: 'text-error', bg: 'bg-error-container text-on-error-container' };
  };

  const risk = getRiskLabel(riskScore);
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
      
      {/* VEHICLES DETECTED */}
      <div className="flex flex-col bg-surface-container-low p-space-md rounded-xl border border-outline-variant/20 shadow-sm">
        <span className="font-headline-sm text-on-surface font-semibold mb-2">Vehicles Detected</span>
        <div className="flex items-baseline gap-2">
          <span className="font-display-lg text-primary">{totalVehicles !== undefined ? totalVehicles : '--'}</span>
        </div>
        <span className="font-body-sm text-on-surface-variant mt-1">
          {totalVehicles !== undefined ? 'Historical trajectory-file records' : 'No vehicle-count data available'}
        </span>
      </div>

      {/* AVERAGE SPEED */}
      <div className="flex flex-col bg-surface-container-low p-space-md rounded-xl border border-outline-variant/20 shadow-sm">
        <span className="font-headline-sm text-on-surface font-semibold mb-2">Average Speed</span>
        <div className="flex items-baseline gap-2">
          <span className="font-display-lg text-primary">{avgSpeed !== undefined ? avgSpeed.toFixed(1) : '--'}</span>
          <span className="font-body-sm font-semibold text-on-surface-variant">km/h</span>
        </div>
        <span className="font-body-sm text-on-surface-variant mt-1">
          Historical trajectory data; not a calibrated live speed
        </span>
      </div>

      {/* TRAFFIC FLOW */}
      <div className="flex flex-col bg-surface-container-low p-space-md rounded-xl border border-outline-variant/20 shadow-sm">
        <span className="font-headline-sm text-on-surface font-semibold mb-2">Traffic Flow</span>
        <div className="flex items-baseline gap-2">
          <span className="font-display-lg text-primary">--</span>
          <span className="font-body-sm font-semibold text-on-surface-variant">veh / min</span>
        </div>
        <span className="font-body-sm text-on-surface-variant mt-1">
          Density: {trafficDensity !== undefined ? `${trafficDensity}% capacity` : 'Unavailable without calibration'}
        </span>
      </div>

      {/* RISK LEVEL */}
      <div className="flex flex-col bg-surface-container-low p-space-md rounded-xl border border-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="font-headline-sm text-on-surface font-semibold">Risk Level</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${risk.bg}`}>
            {risk.label}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`font-display-lg ${risk.color}`}>{riskScore !== undefined ? riskScore : '--'}</span>
          <span className="font-body-sm font-semibold text-on-surface-variant">/ 100</span>
        </div>
        <span className="font-body-sm text-on-surface-variant mt-1">
          Not computed — no conflict-event telemetry
        </span>
      </div>

    </section>
  );
};
