import React from 'react';

export const ReportsView: React.FC = () => (
  <section className="flex flex-col gap-space-lg">
    <header className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-space-lg">
      <h1 className="font-headline-lg font-bold text-on-surface">Traffic Reports</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        No conflict-event detector is currently producing validated incident records. The dashboard will not invent incident counts, severity, or audit exports.
      </p>
    </header>
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-space-lg">
      <h2 className="font-headline-md font-semibold text-on-surface">Recorded Video Exports</h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        Download final category totals, confirmed track details, minute-offset counts, annotated video, and processing summary from the corresponding session in Traffic Monitor.
      </p>
      <p className="mt-3 text-xs text-amber-300">
        Vehicle conflict/PET alerts and signal-cycle efficiency are not implemented telemetry and are intentionally unavailable.
      </p>
    </div>
  </section>
);
