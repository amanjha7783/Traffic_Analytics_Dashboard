import React from 'react';

interface KpiRowProps {
  totalVehicles: number;
  activeTracks: number;
  avgSpeed: number;
  riskScore: number;
  trafficDensity: number;
  conflictZones: number;
}

export const KpiRow: React.FC<KpiRowProps> = ({
  totalVehicles,
  activeTracks,
  avgSpeed,
  riskScore,
  trafficDensity,
}) => {
  const getRiskLabel = (score: number) => {
    if (score < 40) return { label: 'Low', color: 'text-tertiary', bg: 'bg-tertiary-container text-on-tertiary-container' };
    if (score < 75) return { label: 'Medium', color: 'text-amber-500', bg: 'bg-amber-100 text-amber-800' };
    return { label: 'High', color: 'text-error', bg: 'bg-error-container text-on-error-container' };
  };

  const risk = getRiskLabel(riskScore);
  const flowRate = Math.round((totalVehicles || 0) / 3); // Simple mock flow rate calculation based on totals

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
      
      {/* VEHICLES DETECTED */}
      <div className="flex flex-col bg-surface-container-low p-space-md rounded-xl border border-outline-variant/20 shadow-sm">
        <span className="font-headline-sm text-on-surface font-semibold mb-2">Vehicles Detected</span>
        <div className="flex items-baseline gap-2">
          <span className="font-display-lg text-primary">{totalVehicles !== undefined ? totalVehicles : '--'}</span>
        </div>
        <span className="font-body-sm text-on-surface-variant mt-1">
          {activeTracks !== undefined ? `${activeTracks} currently active in zone` : 'Tracking active vehicles'}
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
          Target flow speed: 40.0 km/h
        </span>
      </div>

      {/* TRAFFIC FLOW */}
      <div className="flex flex-col bg-surface-container-low p-space-md rounded-xl border border-outline-variant/20 shadow-sm">
        <span className="font-headline-sm text-on-surface font-semibold mb-2">Traffic Flow</span>
        <div className="flex items-baseline gap-2">
          <span className="font-display-lg text-primary">{flowRate || '--'}</span>
          <span className="font-body-sm font-semibold text-on-surface-variant">veh / min</span>
        </div>
        <span className="font-body-sm text-on-surface-variant mt-1">
          Density: {trafficDensity !== undefined ? `${trafficDensity}% capacity` : 'Stable'}
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
          Spatial collision potential index
        </span>
      </div>

    </section>
  );
};
