import React, { useMemo, useState } from 'react';
import type { VehicleTrack } from '../types';

interface TrajectoriesSectionProps {
  vehicleTracks: VehicleTrack[];
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
}

export const TrajectoriesSection: React.FC<TrajectoriesSectionProps> = ({
  vehicleTracks,
  selectedVehicleId,
  onSelectVehicle,
}) => {
  const [filterType, setFilterType] = useState('All');
  const types = useMemo(() => [...new Set(vehicleTracks.map((track) => track.type))], [vehicleTracks]);
  const filteredTracks = vehicleTracks.filter((track) => filterType === 'All' || track.type === filterType);

  const exportCsv = () => {
    const rows = [
      ['vehicle_id', 'vehicle_type', 'timestamp', 'x', 'y', 'speed'],
      ...filteredTracks.map((track) => [
        track.id, track.type, track.timestamp, track.x, track.y, track.speed ?? '',
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'trajectory_file_records.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="flex flex-col gap-space-md rounded-xl border border-outline-variant/10 bg-surface-container-low p-space-lg">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg font-bold text-on-surface">Trajectory File Records</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Historical input coordinates only. These points are not a calibrated world map, active CCTV tracks, or physical-speed measurements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterType} onChange={(event) => setFilterType(event.target.value)}
            className="rounded-lg border border-outline-variant/20 bg-surface-container px-3 py-2 text-sm text-on-surface">
            <option value="All">All categories</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <button onClick={exportCsv} disabled={filteredTracks.length === 0}
            className="rounded-lg bg-primary-container px-3 py-2 text-sm font-semibold text-on-primary-container disabled:opacity-50">
            Export visible records
          </button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-lg border border-outline-variant/20">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-container text-xs uppercase text-on-surface-variant">
            <tr>
              <th className="px-4 py-3">Vehicle ID</th>
              <th className="px-4 py-3">Input class</th>
              <th className="px-4 py-3">Timestamp (source)</th>
              <th className="px-4 py-3">X (source)</th>
              <th className="px-4 py-3">Y (source)</th>
              <th className="px-4 py-3">Speed (source)</th>
            </tr>
          </thead>
          <tbody>
            {filteredTracks.map((track) => (
              <tr key={`${track.id}-${track.timestamp}`} onClick={() => onSelectVehicle(track.id)}
                className={`cursor-pointer border-t border-outline-variant/10 ${track.id === selectedVehicleId ? 'bg-primary/10' : 'hover:bg-surface-container'}`}>
                <td className="px-4 py-3 font-mono text-primary">{track.id}</td>
                <td className="px-4 py-3 text-on-surface">{track.type}</td>
                <td className="px-4 py-3 font-mono text-on-surface-variant">{track.timestamp}</td>
                <td className="px-4 py-3 font-mono text-on-surface-variant">{track.x}</td>
                <td className="px-4 py-3 font-mono text-on-surface-variant">{track.y}</td>
                <td className="px-4 py-3 font-mono text-on-surface-variant">{track.speed ?? 'Unavailable'}</td>
              </tr>
            ))}
            {filteredTracks.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant">No trajectory-file records are available.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-on-surface-variant">{filteredTracks.length} source records shown · no homography calibration applied</p>
    </section>
  );
};
