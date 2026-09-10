import React, { useState } from 'react';
import { INCIDENT_LOGS } from '../data/mockData';
import { IncidentAlert } from '../types';

export const ReportsView: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentAlert[]>(INCIDENT_LOGS);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [exportToast, setExportToast] = useState<string | null>(null);

  const filteredIncidents = incidents.filter((item) => {
    if (severityFilter === 'ALL') return true;
    return item.severity === severityFilter;
  });

  const handleResolve = (id: string) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, resolved: !inc.resolved } : inc))
    );
  };

  const handleDownloadReport = (format: 'PDF' | 'CSV') => {
    setExportToast(`Generating Safety Audit Report in ${format}... Complete.`);
    setTimeout(() => setExportToast(null), 2500);
  };

  return (
    <div className="flex flex-col gap-space-lg">
      {/* Header & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-space-md bg-surface-container-low p-space-md rounded-xl border border-outline-variant/10">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-headline-md text-headline-md font-bold text-on-surface">
              Safety Audit & Collision Risk Log
            </span>
            <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary font-label-caps text-label-caps font-bold">
              OFFICIAL TELEMETRY
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Automated conflict detections, post-encroachment times (PET), and near-miss threshold violations
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadReport('CSV')}
            className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface hover:text-primary text-xs font-semibold flex items-center gap-1.5 border border-outline-variant/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">table_view</span>
            Export CSV
          </button>
          <button
            onClick={() => handleDownloadReport('PDF')}
            className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:brightness-105 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Download Audit PDF
          </button>
        </div>
      </div>

      {exportToast && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/40 text-primary text-xs font-mono flex items-center gap-2 animate-fade">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          {exportToast}
        </div>
      )}

      {/* Safety Summary KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-space-md">
        <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/10 flex flex-col">
          <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Total Conflict Events</span>
          <span className="font-display-lg text-2xl font-bold text-on-surface mt-1">42</span>
          <span className="text-[11px] text-tertiary mt-0.5 font-mono">↓ 14% vs yesterday</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/10 flex flex-col">
          <span className="font-label-caps text-[10px] text-error uppercase">Critical TTC &lt; 1.0s</span>
          <span className="font-display-lg text-2xl font-bold text-error mt-1">6</span>
          <span className="text-[11px] text-error mt-0.5 font-mono">Requires intervention</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/10 flex flex-col">
          <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Average PET Interval</span>
          <span className="font-display-lg text-2xl font-bold text-primary mt-1">1.82s</span>
          <span className="text-[11px] text-on-surface-variant mt-0.5 font-mono">Nominal threshold: 1.5s</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/10 flex flex-col">
          <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Signal Cycle Efficiency</span>
          <span className="font-display-lg text-2xl font-bold text-tertiary mt-1">91.4%</span>
          <span className="text-[11px] text-tertiary mt-0.5 font-mono">Optimal green balance</span>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="flex flex-col bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden shadow-md">
        <div className="p-space-md bg-surface-container flex flex-wrap items-center justify-between gap-space-sm border-b border-outline-variant/20">
          <span className="font-headline-sm text-sm font-bold text-on-surface">
            Recorded Incident Events (Last 60 Minutes)
          </span>

          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-on-surface-variant mr-1">Filter Severity:</span>
            {['ALL', 'CRITICAL', 'ELEVATED', 'MODERATE'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  severityFilter === sev
                    ? 'bg-primary text-on-primary font-bold'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
            <thead className="bg-surface-container-high/40 text-on-surface-variant font-label-caps uppercase border-b border-outline-variant/20">
              <tr>
                <th className="py-2.5 px-4">Incident ID</th>
                <th className="py-2.5 px-4">Time (UTC)</th>
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4">Conflict Type</th>
                <th className="py-2.5 px-4">Severity</th>
                <th className="py-2.5 px-4">Involved Tracks</th>
                <th className="py-2.5 px-4">Risk Score</th>
                <th className="py-2.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredIncidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-surface-container transition-colors">
                  <td className="py-3 px-4 font-mono text-primary font-semibold">{inc.id}</td>
                  <td className="py-3 px-4 font-mono text-on-surface-variant">{inc.timestamp}</td>
                  <td className="py-3 px-4 text-on-surface">{inc.location}</td>
                  <td className="py-3 px-4 font-medium text-on-surface">{inc.type}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded font-label-caps text-[9px] font-bold ${
                        inc.severity === 'CRITICAL'
                          ? 'bg-error/20 text-error'
                          : inc.severity === 'ELEVATED'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-tertiary/20 text-tertiary'
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-on-surface">
                    {inc.primaryVehicles.join(', ')}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-on-surface">
                    {inc.score}/100
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleResolve(inc.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                        inc.resolved
                          ? 'bg-surface-container-high text-tertiary'
                          : 'bg-error-container text-error hover:brightness-110'
                      }`}
                    >
                      {inc.resolved ? 'RESOLVED' : 'DISPATCH'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
