import React from 'react';

interface KpiRowProps {
  totalVehicles?: number;
  activeTracks?: number;
  avgSpeed?: number;
  trafficDensity?: number;
  conflictZones?: number;
  riskScore?: number;
}

export const KpiRow: React.FC<KpiRowProps> = ({
  totalVehicles = 247,
  activeTracks = 38,
  avgSpeed = 32.4,
  trafficDensity = 68,
  conflictZones = 4,
  riskScore = 64,
}) => {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md">
      {/* Card 1: Total Vehicles */}
      <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-container transition-colors">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
            Total Vehicles
          </span>
          <span className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[16px]">directions_car</span>
          </span>
        </div>
        <div className="mt-space-sm flex items-baseline justify-between">
          <span className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight" id="kpi-total-veh">
            {totalVehicles}
          </span>
          <span className="flex items-center gap-0.5 text-tertiary font-data-mono-sm text-data-mono-sm font-semibold bg-tertiary/10 px-1.5 py-0.5 rounded">
            <span className="material-symbols-outlined text-[12px]">trending_up</span>
            +12%
          </span>
        </div>
        <div className="mt-space-xs flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
          <span>Tracked cumulative</span>
          <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">Last 10 min</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-transparent opacity-40"></div>
      </div>

      {/* Card 2: Active Tracks */}
      <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-container transition-colors">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
            Active Tracks
          </span>
          <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-surface-container text-tertiary font-data-mono-sm text-data-mono-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-tertiary"></span>
            </span>
            LIVE
          </span>
        </div>
        <div className="mt-space-sm flex items-baseline justify-between">
          <span className="font-display-lg text-display-lg font-bold text-tertiary tracking-tight" id="kpi-active-tracks">
            {activeTracks}
          </span>
          <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">In Junction ROI</span>
        </div>
        <div className="mt-space-xs flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
          <span>ByteTrack v2.1</span>
          <span className="text-tertiary font-data-mono-sm text-data-mono-sm">0 loss</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-tertiary to-transparent opacity-40"></div>
      </div>

      {/* Card 3: Avg. Speed */}
      <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-container transition-colors">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
            Avg. Speed
          </span>
          <span className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[16px]">speed</span>
          </span>
        </div>
        <div className="mt-space-sm flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            <span className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight">
              {avgSpeed.toFixed(1)}
            </span>
            <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">km/h</span>
          </div>
          <span className="font-data-mono-sm text-data-mono-sm text-primary">Normal flow</span>
        </div>
        <div className="mt-space-xs flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
          <span>Across active</span>
          <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">Span: 12–54 km/h</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-secondary-container to-transparent opacity-40"></div>
      </div>

      {/* Card 4: Traffic Density */}
      <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-container transition-colors">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
            Traffic Density
          </span>
          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-label-caps text-label-caps font-semibold">
            MODERATE
          </span>
        </div>
        <div className="mt-space-sm flex items-baseline justify-between">
          <span className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight">
            {trafficDensity}%
          </span>
          <span className="text-on-surface-variant font-data-mono-sm text-data-mono-sm">Cap: 85%</span>
        </div>
        <div className="mt-space-xs flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
          <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden mr-2">
            <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${trafficDensity}%` }}></div>
          </div>
          <span className="font-data-mono-sm text-data-mono-sm text-amber-400 whitespace-nowrap">Queue+</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-transparent opacity-40"></div>
      </div>

      {/* Card 5: Conflict Zones */}
      <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-container transition-colors">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps uppercase text-error tracking-wider">
            Conflict Zones
          </span>
          <span className="w-7 h-7 rounded bg-error-container/40 flex items-center justify-center text-error">
            <span className="material-symbols-outlined text-[16px]">crisis_alert</span>
          </span>
        </div>
        <div className="mt-space-sm flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display-lg text-display-lg font-bold text-error tracking-tight">
              {conflictZones}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">active</span>
          </div>
          <div className="flex items-center gap-1 font-data-mono-sm text-data-mono-sm text-error bg-error/10 px-2 py-0.5 rounded">
            <span>Score:</span>
            <span className="font-bold">{riskScore}/100</span>
          </div>
        </div>
        <div className="mt-space-xs flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
          <span className="text-error">TTC &lt; 1.5s alerts</span>
          <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">Junction 67</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-error to-transparent opacity-60"></div>
      </div>
    </section>
  );
};
