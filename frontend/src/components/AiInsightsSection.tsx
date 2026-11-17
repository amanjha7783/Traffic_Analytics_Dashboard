import React from 'react';

interface Props {
  onViewAnalytics: () => void;
}

export const AiInsightsSection: React.FC<Props> = ({ onViewAnalytics }) => {
  return (
    <section className="bg-surface-container-low p-space-lg rounded-xl border border-outline-variant/20 shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-md">
      <div className="flex flex-col gap-4 max-w-2xl">
        <span className="font-headline-md text-on-surface font-semibold">Traffic Insights</span>
        <ul className="flex flex-col gap-2 text-on-surface-variant font-body-lg list-disc pl-5">
          <li>Live camera measurements appear after a configured camera is connected in Traffic Monitor.</li>
          <li>Physical speed and road occupancy require a camera-specific ground-plane calibration.</li>
          <li>Conflict and near-miss alerts are unavailable until a validated conflict detector is integrated.</li>
        </ul>
      </div>
      
      <button 
        onClick={onViewAnalytics}
        className="px-6 py-3 bg-surface-container-high text-on-surface border border-outline-variant/30 rounded-lg font-semibold flex items-center gap-2 hover:bg-surface-container-highest hover:text-primary transition-colors whitespace-nowrap"
      >
        View Detailed Analytics
        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
      </button>
    </section>
  );
};
