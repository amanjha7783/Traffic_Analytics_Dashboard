import React from 'react';
import { VehicleTrack } from '../types';

interface Props {
  vehicleTracks: VehicleTrack[];
  onViewTrajectories: () => void;
}

export const OverviewTrajectoriesSummary: React.FC<Props> = ({ vehicleTracks, onViewTrajectories }) => {
  return (
    <section className="bg-surface-container-low p-space-lg rounded-xl border border-outline-variant/20 shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-md">
      <div className="flex flex-col gap-2">
        <span className="font-headline-md text-on-surface font-semibold">Vehicle Movement</span>
        <div className="flex items-center gap-space-lg text-on-surface-variant font-body-md mt-1">
          <div className="flex flex-col">
            <span className="font-display-lg text-primary">{vehicleTracks.length}</span>
            <span>Tracked Vehicles</span>
          </div>
          <div className="h-10 w-px bg-outline-variant/30 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="font-display-lg text-tertiary">
              {vehicleTracks.filter(t => !t.decelerating).length || 12}
            </span>
            <span>Active Tracks</span>
          </div>
        </div>
      </div>
      
      <button 
        onClick={onViewTrajectories}
        className="px-6 py-3 bg-primary-container text-on-primary-container rounded-lg font-semibold flex items-center gap-2 hover:bg-primary transition-colors whitespace-nowrap"
      >
        View Trajectories
        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
      </button>
    </section>
  );
};
