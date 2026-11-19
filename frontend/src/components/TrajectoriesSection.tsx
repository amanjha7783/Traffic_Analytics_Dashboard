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
  const [searchId, setSearchId] = useState('');
  const [sortField, setSortField] = useState<'id' | 'timestamp' | 'speed' | 'type'>('timestamp');
  const [sortAsc, setSortAsc] = useState(false);

  const types = useMemo(() => [...new Set(vehicleTracks.map((track) => track.type))], [vehicleTracks]);

  const filteredAndSortedTracks = useMemo(() => {
    let result = vehicleTracks.filter((track) => {
      const matchesType = filterType === 'All' || track.type === filterType;
      const matchesSearch = !searchId.trim() || track.id.toLowerCase().includes(searchId.trim().toLowerCase());
      return matchesType && matchesSearch;
    });

    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (sortField === 'id') {
        valA = Number(a.id) || a.id;
        valB = Number(b.id) || b.id;
      }
      if (valA === undefined) return 1;
      if (valB === undefined) return -1;
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [vehicleTracks, filterType, searchId, sortField, sortAsc]);

  const toggleSort = (field: 'id' | 'timestamp' | 'speed' | 'type') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['vehicle_id', 'vehicle_type', 'timestamp', 'x', 'y', 'speed'],
      ...filteredAndSortedTracks.map((track) => [
        track.id, track.type, track.timestamp, track.x, track.y, track.speed ?? '',
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `traffic_trajectories_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="p-4 rounded border border-outline-variant bg-surface flex flex-col gap-3">
      {/* Section Header & Controls */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[18px]">timeline</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-on-surface">
                Spatial Trajectory Telemetry
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-surface-container-high text-on-surface-variant border border-outline-variant">
                {filteredAndSortedTracks.length} RECORDS
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Chronological raw 2D pixel trajectory logs from YOLOv8 automated tracker inferences
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-outline-variant bg-surface-container-low text-xs">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">search</span>
            <input
              type="text"
              placeholder="Search Vehicle ID..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-on-surface placeholder:text-on-surface-variant/60 w-28 sm:w-36"
            />
            {searchId && (
              <button onClick={() => setSearchId('')} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>

          {/* Category Filter */}
          <select 
            value={filterType} 
            onChange={(event) => setFilterType(event.target.value)}
            className="rounded border border-outline-variant bg-surface-container-low px-2.5 py-1 text-xs text-on-surface focus:outline-none focus:border-primary cursor-pointer font-medium"
          >
            <option value="All">All Categories ({types.length})</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>

          {/* Export Action */}
          <button 
            onClick={exportCsv} 
            disabled={filteredAndSortedTracks.length === 0}
            className="rounded bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export CSV</span>
          </button>
        </div>
      </header>

      {/* Trajectory Table */}
      <div className="overflow-x-auto rounded border border-outline-variant bg-surface-container-low">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-surface text-[11px] font-mono font-semibold uppercase text-on-surface-variant border-b border-outline-variant select-none">
            <tr>
              <th 
                className="px-3 py-2 cursor-pointer hover:text-on-surface"
                onClick={() => toggleSort('id')}
              >
                <div className="flex items-center gap-1">
                  <span>Track ID</span>
                  {sortField === 'id' && (
                    <span className="material-symbols-outlined text-[14px] text-primary">
                      {sortAsc ? 'arrow_upward' : 'arrow_downward'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-2 cursor-pointer hover:text-on-surface"
                onClick={() => toggleSort('type')}
              >
                <div className="flex items-center gap-1">
                  <span>Taxonomy</span>
                  {sortField === 'type' && (
                    <span className="material-symbols-outlined text-[14px] text-primary">
                      {sortAsc ? 'arrow_upward' : 'arrow_downward'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-2 cursor-pointer hover:text-on-surface"
                onClick={() => toggleSort('timestamp')}
              >
                <div className="flex items-center gap-1">
                  <span>Timestamp</span>
                  {sortField === 'timestamp' && (
                    <span className="material-symbols-outlined text-[14px] text-primary">
                      {sortAsc ? 'arrow_upward' : 'arrow_downward'}
                    </span>
                  )}
                </div>
              </th>
              <th className="px-3 py-2">X Coordinate</th>
              <th className="px-3 py-2">Y Coordinate</th>
              <th 
                className="px-3 py-2 cursor-pointer hover:text-on-surface"
                onClick={() => toggleSort('speed')}
              >
                <div className="flex items-center gap-1">
                  <span>Pixel Velocity</span>
                  {sortField === 'speed' && (
                    <span className="material-symbols-outlined text-[14px] text-primary">
                      {sortAsc ? 'arrow_upward' : 'arrow_downward'}
                    </span>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant font-mono">
            {filteredAndSortedTracks.slice(0, 150).map((track) => {
              const isSelected = track.id === selectedVehicleId;
              return (
                <tr 
                  key={`${track.id}-${track.timestamp}`} 
                  onClick={() => onSelectVehicle(track.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-primary/10 text-primary font-semibold' 
                      : 'hover:bg-surface-container text-on-surface'
                  }`}
                >
                  <td className="px-3 py-1.5 font-semibold text-primary">
                    #{track.id}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="px-1.5 py-0.2 rounded border border-outline-variant bg-surface text-[10px] text-on-surface font-sans uppercase">
                      {track.type}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-on-surface-variant">
                    {track.timestamp.toFixed(2)}s
                  </td>
                  <td className="px-3 py-1.5 text-on-surface-variant">
                    {track.x.toFixed(1)} px
                  </td>
                  <td className="px-3 py-1.5 text-on-surface-variant">
                    {track.y.toFixed(1)} px
                  </td>
                  <td className="px-3 py-1.5">
                    {track.speed !== undefined ? (
                      <span className="text-success font-semibold">{track.speed.toFixed(1)} px/s</span>
                    ) : (
                      <span className="text-on-surface-variant/50 italic">Unmeasured</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredAndSortedTracks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-on-surface-variant text-xs">
                  No trajectory records match your search or filter parameters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-on-surface-variant font-mono pt-1">
        <span>Showing {Math.min(150, filteredAndSortedTracks.length)} of {filteredAndSortedTracks.length} records</span>
        <span>Pixel coordinates are recorded in native inference image space</span>
      </div>
    </section>
  );
};
