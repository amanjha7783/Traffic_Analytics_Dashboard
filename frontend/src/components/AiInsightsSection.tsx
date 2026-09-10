import React from 'react';

export const AiInsightsSection: React.FC = () => {
  return (
    <section className="flex flex-col bg-surface-container-low rounded-xl p-space-md lg:p-space-lg shadow-md gap-space-md relative overflow-hidden border border-outline-variant/10">
      {/* Ambient Background Lighting */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">psychology</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                Traffic Intelligence AI
              </span>
              <span className="px-2 py-0.5 rounded bg-primary text-on-primary font-label-caps text-label-caps uppercase font-bold">
                SYNTHESIS
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Real-time analytical summaries derived from trajectory tracking & proximity heuristics
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-data-mono-sm text-data-mono-sm text-tertiary flex items-center gap-1.5 px-2 py-1 rounded bg-tertiary/10 border border-tertiary/20">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-ping"></span>
            Auto-Refreshing
          </span>
        </div>
      </div>

      {/* 3 Structured Insight Callout Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        {/* Callout 1 */}
        <div className="p-space-md rounded-xl bg-surface-container flex flex-col justify-between hover:bg-surface-container-high transition-colors border border-outline-variant/10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-label-caps text-primary uppercase font-bold tracking-widest">
                INSIGHT #01 • QUEUE DELAY
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-data-mono-sm text-[10px] font-semibold border border-amber-400/30">
                T-PHASE
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
              Traffic density peaks around the central intersection, causing recurring{' '}
              <span className="font-semibold text-primary">4.2-second queue delays</span> during eastbound green phases due to heavy right-turning queue spillovers.
            </p>
          </div>
          <div className="mt-space-sm pt-space-xs border-t border-outline-variant/10 flex items-center justify-between text-on-surface-variant font-data-mono-sm text-[11px]">
            <span>Confidence: 94.2%</span>
            <span className="text-primary font-medium">Mitigation: Extend +5s</span>
          </div>
        </div>

        {/* Callout 2 */}
        <div className="p-space-md rounded-xl bg-surface-container flex flex-col justify-between hover:bg-surface-container-high transition-colors border border-outline-variant/10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-label-caps text-primary uppercase font-bold tracking-widest">
                INSIGHT #02 • FLOW FRICTION
              </span>
              <span className="px-1.5 py-0.5 rounded bg-secondary/20 text-secondary font-data-mono-sm text-[10px] font-semibold border border-secondary/30">
                APPROACH
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
              Eastbound movement shows highest vehicle volume (<span className="font-semibold text-primary">142 veh/hr</span>), generating significant left-turn trajectory friction with westbound oncoming traffic during permissive clearance.
            </p>
          </div>
          <div className="mt-space-sm pt-space-xs border-t border-outline-variant/10 flex items-center justify-between text-on-surface-variant font-data-mono-sm text-[11px]">
            <span>Volume: +24% vs Base</span>
            <span className="text-secondary font-medium">Risk: High Lateral</span>
          </div>
        </div>

        {/* Callout 3 */}
        <div className="p-space-md rounded-xl bg-surface-container flex flex-col justify-between hover:bg-surface-container-high transition-colors border border-outline-variant/10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-label-caps text-error uppercase font-bold tracking-widest">
                INSIGHT #03 • CONFLICT APEX
              </span>
              <span className="px-1.5 py-0.5 rounded bg-error/20 text-error font-data-mono-sm text-[10px] font-semibold border border-error/30">
                TTC &lt; 1.0s
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
              Trajectory overlap indicates increased potential risk near junction center due to{' '}
              <span className="font-semibold text-error">unsignalized turning gaps</span> and abrupt braking events by heavy multi-axle freight.
            </p>
          </div>
          <div className="mt-space-sm pt-space-xs border-t border-outline-variant/10 flex items-center justify-between text-on-surface-variant font-data-mono-sm text-[11px]">
            <span>Severity: 64/100</span>
            <span className="text-error font-medium">Alert Dispatched</span>
          </div>
        </div>
      </div>

      {/* AI Footer Note */}
      <div className="flex flex-wrap items-center justify-between text-on-surface-variant font-body-sm text-body-sm pt-1">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
          Generated from computer vision trajectory analytics • Analytical risk modeling (Prototype v2.4)
        </span>
        <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
          Validated against 10,000+ intersection track vectors
        </span>
      </div>
    </section>
  );
};
