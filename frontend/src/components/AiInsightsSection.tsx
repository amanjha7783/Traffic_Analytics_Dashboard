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
          <li>Traffic concentration is highest around the central intersection.</li>
          <li>Average vehicle speed decreases sharply during high-density periods.</li>
          <li>Most conflict points occur during unprotected left turns.</li>
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
