import React, { useState } from 'react';

interface TrafficOverviewCardProps {
  onViewDetailedAnalytics: () => void;
}

export const TrafficOverviewCard: React.FC<TrafficOverviewCardProps> = ({
  onViewDetailedAnalytics,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pulseMetric, setPulseMetric] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setPulseMetric(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setPulseMetric(false);
    }, 600);
  };

  return (
    <div className="flex flex-col justify-between bg-surface-container-low rounded-xl p-space-lg shadow-md h-full border border-outline-variant/10">
      <div className="flex flex-col gap-space-md">
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Traffic Overview
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Intersection 67 Analytical Digest
            </span>
          </div>
          <button 
            onClick={handleRefresh}
            className={`w-7 h-7 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-primary flex items-center justify-center transition-all ${
              isRefreshing ? 'animate-spin text-primary' : ''
            }`}
            title="Sync Latest Analytics"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
          </button>
        </div>

        {/* Metric Grid */}
        <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
          <div className="p-space-sm rounded-lg bg-surface-container flex flex-col">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Vehicles Detected
            </span>
            <span className={`font-display-lg text-headline-lg font-bold text-on-surface mt-1 transition-transform ${pulseMetric ? 'scale-105 text-primary' : ''}`}>
              247
            </span>
            <span className="font-data-mono-sm text-[11px] text-tertiary mt-0.5">
              ↑ 8.4% this interval
            </span>
          </div>

          <div className="p-space-sm rounded-lg bg-surface-container flex flex-col">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Flow Rate
            </span>
            <span className="font-display-lg text-headline-lg font-bold text-primary mt-1">
              82 <span className="text-body-sm font-normal text-on-surface-variant">v/min</span>
            </span>
            <span className="font-data-mono-sm text-[11px] text-on-surface-variant mt-0.5">
              High throughput
            </span>
          </div>

          <div className="p-space-sm rounded-lg bg-surface-container flex flex-col">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Mean Velocity
            </span>
            <span className="font-display-lg text-headline-lg font-bold text-on-surface mt-1">
              32.4 <span className="text-body-sm font-normal text-on-surface-variant">km/h</span>
            </span>
            <span className="font-data-mono-sm text-[11px] text-on-surface-variant mt-0.5">
              Target: 40 km/h
            </span>
          </div>

          <div className="p-space-sm rounded-lg bg-surface-container flex flex-col">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Conflict Potential
            </span>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-label-caps text-label-caps font-bold">
                MEDIUM
              </span>
              <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
                64/100
              </span>
            </div>
            <span className="font-data-mono-sm text-[11px] text-amber-400 mt-1">
              4 Conflict Points
            </span>
          </div>
        </div>

        {/* Traffic Density Progress Bar Component */}
        <div className="flex flex-col gap-1.5 p-space-sm rounded-lg bg-surface-container border border-outline-variant/10">
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-on-surface font-medium">Intersection Occupancy</span>
            <span className="font-data-mono-sm text-data-mono-sm text-amber-400 font-semibold">
              68% / 85% Limit
            </span>
          </div>
          <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden flex">
            <div className="bg-primary h-full" style={{ width: '45%' }}></div>
            <div className="bg-amber-400 h-full" style={{ width: '23%' }}></div>
            <div className="bg-transparent h-full" style={{ width: '32%' }}></div>
          </div>
          <div className="flex items-center justify-between text-[11px] font-data-mono-sm text-on-surface-variant">
            <span>Free Flow (0-50%)</span>
            <span>Congestion Risk (&gt;85%)</span>
          </div>
        </div>

        {/* Rush Hour Peak Callout */}
        <div className="flex items-center gap-space-sm p-space-sm rounded-lg bg-surface-container border-l-2 border-primary">
          <span className="material-symbols-outlined text-primary text-[20px]">access_time</span>
          <div className="flex flex-col">
            <span className="font-body-sm text-body-sm font-semibold text-on-surface">
              Peak Rush Hour Window
            </span>
            <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
              17:30 – 18:30 UTC • +38% Expected Flow
            </span>
          </div>
        </div>

        {/* CV AI Generated Insight Pill */}
        <div className="p-space-sm rounded-lg bg-surface-container-high/60 flex flex-col gap-1 border border-outline-variant/10">
          <div className="flex items-center gap-1.5 text-primary">
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            <span className="font-label-caps text-label-caps uppercase font-semibold">
              Spatial Insight
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
            Traffic concentration is highest around the central intersection and eastern approach junction with frequent deceleration spikes from merging vehicles.
          </p>
        </div>
      </div>

      {/* Action Button Link */}
      <button 
        onClick={onViewDetailedAnalytics}
        className="mt-space-md w-full py-2.5 px-space-md rounded-lg bg-primary text-on-primary font-body-md font-semibold flex items-center justify-center gap-2 hover:shadow-[0_0_12px_rgba(6,182,212,0.4)] hover:brightness-105 active:scale-[0.99] transition-all"
      >
        <span>View Detailed Analytics</span>
        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
      </button>
    </div>
  );
};
