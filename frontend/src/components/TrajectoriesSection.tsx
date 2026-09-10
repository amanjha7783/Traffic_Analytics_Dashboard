import React, { useState } from 'react';
import { VehicleTrack } from '../types';

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
  const [filterType, setFilterType] = useState<string>('All');
  const [showPaths, setShowPaths] = useState<boolean>(true);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false);
  const [zoomKey, setZoomKey] = useState<number>(0);

  const activeVehicle = vehicleTracks.find((v) => v.id === selectedVehicleId) || vehicleTracks[0];

  const handleExportCsv = () => {
    const csvContent = [
      'timestamp_ms,vehicle_id,type,world_x_m,world_y_m,speed_kmh,yaw_deg,curvature_rad_m',
      '000,V-024,Sedan,-18.20,4.10,38.0,88.2,0.02',
      '200,V-024,Sedan,-12.40,4.05,37.4,89.1,0.04',
      '400,V-024,Sedan,-6.80,4.00,35.0,91.0,0.08',
      '600,V-024,Sedan,-1.20,3.80,31.2,105.4,0.12',
      '800,V-024,Sedan,2.10,1.80,29.0,128.5,0.15',
      '1000,V-024,Sedan,3.40,-3.40,32.1,154.0,0.11',
      '1200,V-024,Sedan,3.50,-9.80,34.2,178.2,0.03',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `trajectory_${activeVehicle.id}_wgs84.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="flex flex-col bg-surface-container-low rounded-xl p-space-md lg:p-space-lg shadow-md gap-space-md border border-outline-variant/10">
      {/* Header with Controls */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-headline-md text-headline-md font-bold text-on-surface">
              Vehicle Trajectories
            </span>
            <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary font-label-caps text-label-caps uppercase font-semibold">
              Homography Projected
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Tracked vehicle movement across the intersection (Derived from pixel-to-world homography mapping)
          </span>
        </div>

        {/* Trajectory Controls Strip */}
        <div className="flex flex-wrap items-center gap-space-sm">
          {/* Filter Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface font-body-sm text-body-sm border border-outline-variant/20 hover:border-outline-variant/40 transition-colors"
            >
              <span className="text-on-surface-variant font-label-caps text-label-caps uppercase mr-1">
                Filter:
              </span>
              <span className="font-semibold text-primary">
                {filterType === 'All' ? 'All Vehicles (38)' : `${filterType}s`}
              </span>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                expand_more
              </span>
            </button>

            {showFilterMenu && (
              <div className="absolute top-full right-0 mt-1 w-44 bg-surface-container-high rounded-lg border border-outline-variant/30 shadow-xl p-1 z-30 flex flex-col gap-0.5">
                {['All', 'Car', 'Truck', 'Bus', 'Moto'].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setFilterType(t);
                      setShowFilterMenu(false);
                    }}
                    className={`px-2 py-1 text-xs text-left rounded ${
                      filterType === t
                        ? 'bg-primary-container text-on-primary-container font-semibold'
                        : 'text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {t === 'All' ? 'All Vehicles (38)' : `${t}s`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Select ID Pill */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-label-caps text-label-caps font-bold shadow-sm">
            <span>Active Track:</span>
            <span className="bg-black/20 px-1.5 py-0.5 rounded font-mono">
              {activeVehicle.id}
            </span>
          </div>

          {/* Toggle Paths Switch */}
          <button 
            onClick={() => setShowPaths(!showPaths)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-body-sm text-body-sm transition-colors ${
              showPaths 
                ? 'bg-surface-container text-tertiary border border-tertiary/30' 
                : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">show_chart</span>
            <span>Paths: {showPaths ? 'ON' : 'OFF'}</span>
          </button>

          {/* Reset Zoom Button */}
          <button 
            onClick={() => setZoomKey((prev) => prev + 1)}
            className="w-8 h-8 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors border border-outline-variant/20" 
            title="Reset Projection Grid"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
          </button>
        </div>
      </div>

      {/* Trajectory Canvas & Embedded Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-stretch">
        {/* Trajectory Coordinate Grid (8 cols) */}
        <div 
          key={zoomKey}
          className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-space-md relative min-h-[380px] flex flex-col justify-between overflow-hidden border border-outline-variant/20"
        >
          {/* Axes Labels */}
          <div className="absolute top-2 left-3 font-data-mono-sm text-[10px] text-on-surface-variant/70 flex items-center gap-2 z-10">
            <span>WORLD_COORDINATE_PLANE [WGS84_LOCAL]</span>
            <span>• ORIGIN [0,0] • 1 GRID = 5.0m</span>
          </div>
          <div className="absolute top-2 right-3 flex items-center gap-3 text-[11px] font-label-caps text-label-caps z-10">
            <span className="flex items-center gap-1 text-primary cursor-pointer" onClick={() => onSelectVehicle('V-024')}>
              <span className="w-2 h-2 rounded-full bg-primary"></span> Car
            </span>
            <span className="flex items-center gap-1 text-secondary cursor-pointer" onClick={() => onSelectVehicle('V-012')}>
              <span className="w-2 h-2 rounded-full bg-secondary"></span> Bus
            </span>
            <span className="flex items-center gap-1 text-amber-400 cursor-pointer" onClick={() => onSelectVehicle('V-018')}>
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> Truck
            </span>
            <span className="flex items-center gap-1 text-tertiary cursor-pointer" onClick={() => onSelectVehicle('V-031')}>
              <span className="w-2 h-2 rounded-full bg-tertiary"></span> Moto
            </span>
          </div>

          {/* SVG Trajectory Canvas */}
          <svg 
            className="w-full h-full my-auto select-none" 
            viewBox="0 0 700 320" 
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <marker id="arrow-cyan" markerWidth="6" markerHeight="6" refX="5" refY="5" viewBox="0 0 10 10" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#4cd7f6" />
              </marker>
              <marker id="arrow-amber" markerWidth="6" markerHeight="6" refX="5" refY="5" viewBox="0 0 10 10" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
              </marker>
              <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="5" viewBox="0 0 10 10" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#adc6ff" />
              </marker>
              <marker id="arrow-green" markerWidth="6" markerHeight="6" refX="5" refY="5" viewBox="0 0 10 10" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#4edea3" />
              </marker>
            </defs>

            {/* Coordinate Grid Lines */}
            <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
              <line x1="50" x2="650" y1="40" y2="40" />
              <line x1="50" x2="650" y1="90" y2="90" />
              <line x1="50" x2="650" y1="140" y2="140" />
              <line x1="50" x2="650" y1="190" y2="190" />
              <line x1="50" x2="650" y1="240" y2="240" />
              <line x1="50" x2="650" y1="290" y2="290" />
              <line x1="70" x2="70" y1="30" y2="300" />
              <line x1="170" x2="170" y1="30" y2="300" />
              <line x1="270" x2="270" y1="30" y2="300" />
              <line x1="370" x2="370" y1="30" y2="300" />
              <line x1="470" x2="470" y1="30" y2="300" />
              <line x1="570" x2="570" y1="30" y2="300" />
            </g>

            {/* Intersection Road Curbs Geometry Outline */}
            <g fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5">
              {/* NW quadrant curb */}
              <path d="M 80,110 L 290,110 Q 320,110 320,60 L 320,30" />
              {/* NE quadrant curb */}
              <path d="M 400,30 L 400,60 Q 400,110 430,110 L 640,110" />
              {/* SW quadrant curb */}
              <path d="M 80,210 L 290,210 Q 320,210 320,260 L 320,300" />
              {/* SE quadrant curb */}
              <path d="M 400,300 L 400,260 Q 400,210 430,210 L 640,210" />
            </g>

            {/* Central Crosshair / Intersection Box */}
            <rect 
              x="320" 
              y="110" 
              width="80" 
              height="100" 
              fill="rgba(6, 182, 212, 0.04)" 
              stroke="rgba(76, 215, 246, 0.25)" 
              strokeDasharray="3 3" 
            />

            {showPaths && (
              <>
                {/* V-01 (Straight West-East, Cyan faint) */}
                <path d="M 90,140 L 320,140 L 440,140 L 630,140" fill="none" stroke="#4cd7f6" strokeWidth="1.5" strokeOpacity="0.4" markerEnd="url(#arrow-cyan)" />
                <text x="100" y="132" fill="#4cd7f6" opacity="0.6" fontFamily="JetBrains Mono" fontSize="9">V-001</text>

                {/* V-12 (Left Turn North-East, Amber trajectory curve) */}
                <g className="cursor-pointer" onClick={() => onSelectVehicle('V-012')}>
                  <path d="M 350,40 L 350,130 Q 355,175 420,175 L 630,175" fill="none" stroke="#adc6ff" strokeWidth={selectedVehicleId === 'V-012' ? 3.5 : 2} strokeLinecap="round" markerEnd="url(#arrow-blue)" />
                  <circle cx="370" cy="165" r="4" fill="#adc6ff" />
                  <text x="360" y="55" fill="#adc6ff" fontFamily="JetBrains Mono" fontSize="9">V-012 (Bus Turn)</text>
                </g>

                {/* V-18 (Straight South-North, Blue) */}
                <g className="cursor-pointer" onClick={() => onSelectVehicle('V-018')}>
                  <path d="M 370,290 L 370,160 L 370,40" fill="none" stroke="#f59e0b" strokeWidth={selectedVehicleId === 'V-018' ? 3.5 : 2} strokeLinecap="round" markerEnd="url(#arrow-amber)" />
                  <text x="380" y="275" fill="#f59e0b" fontFamily="JetBrains Mono" fontSize="9">V-018 (Truck)</text>
                </g>

                {/* V-31 (Right Turn East-North, Green trajectory) */}
                <g className="cursor-pointer" onClick={() => onSelectVehicle('V-031')}>
                  <path d="M 630,185 L 450,185 Q 380,185 380,240 L 380,290" fill="none" stroke="#4edea3" strokeWidth={selectedVehicleId === 'V-031' ? 3.5 : 1.5} strokeLinecap="round" markerEnd="url(#arrow-green)" />
                  <text x="590" y="200" fill="#4edea3" fontFamily="JetBrains Mono" fontSize="9">V-031 (Moto)</text>
                </g>

                {/* V-24: HIGHLIGHTED / SELECTED VEHICLE TRAJECTORY */}
                <g filter="drop-shadow(0 0 8px rgba(76,215,246,0.9))" className="cursor-pointer" onClick={() => onSelectVehicle('V-024')}>
                  <path d="M 90,175 L 280,175 Q 340,175 360,140 L 360,40" fill="none" stroke="#4cd7f6" strokeWidth="3.5" strokeLinecap="round" markerEnd="url(#arrow-cyan)" />
                </g>

                {/* Waypoints with Speed Markers along V-024 */}
                <circle cx="120" cy="175" r="3.5" fill="#0f131c" stroke="#4cd7f6" strokeWidth="2" />
                <circle cx="210" cy="175" r="3.5" fill="#0f131c" stroke="#4cd7f6" strokeWidth="2" />
                <circle cx="300" cy="175" r="4.5" fill="#4cd7f6" />
                <circle cx="348" cy="152" r="3.5" fill="#0f131c" stroke="#4cd7f6" strokeWidth="2" />

                {/* Speed Annotations on Path */}
                <text x="120" y="165" fill="#4cd7f6" fontFamily="JetBrains Mono" fontSize="8" textAnchor="middle">38km/h</text>
                <text x="210" y="165" fill="#4cd7f6" fontFamily="JetBrains Mono" fontSize="8" textAnchor="middle">35km/h</text>
                <text x="300" y="195" fill="#4cd7f6" fontFamily="JetBrains Mono" fontSize="8" fontWeight="700" textAnchor="middle">Apex 29km/h</text>

                {/* Selected Target Ring */}
                <circle cx="360" cy="70" r="8" fill="none" stroke="#4cd7f6" strokeWidth="2" strokeDasharray="3 2" className="animate-spin origin-[360px_70px]" />
                <circle cx="360" cy="70" r="3" fill="#4cd7f6" />
                <text x="375" y="74" fill="#ffffff" fontFamily="Space Grotesk" fontSize="10" fontWeight="700">
                  {activeVehicle.id} [ACTIVE]
                </text>
              </>
            )}
          </svg>

          {/* Bottom Legend & Coordinates */}
          <div className="flex items-center justify-between text-[11px] font-data-mono-sm text-on-surface-variant pt-2 border-t border-outline-variant/10">
            <span>Direction Vectors: Normalized Pixel-To-World</span>
            <span>Camera Pitch: 32.5° • Yaw: -12.0°</span>
          </div>
        </div>

        {/* Embedded Telemetry Drawer/Panel (4 cols) */}
        <div className="lg:col-span-4 bg-surface-container rounded-xl p-space-md flex flex-col justify-between border border-outline-variant/20 shadow-sm">
          <div className="flex flex-col gap-space-sm">
            {/* Selected Object Header */}
            <div className="flex items-center justify-between pb-space-xs border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary animate-pulse"></span>
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  Tracked: {activeVehicle.id}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded font-label-caps text-label-caps font-bold transition-colors ${
                isLocked ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {isLocked ? 'LOCK ACQUIRED' : 'SEARCHING'}
              </span>
            </div>

            {/* Parameter List */}
            <div className="flex flex-col gap-2 pt-1 font-body-sm text-body-sm">
              <div className="flex items-center justify-between py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Classification</span>
                <span className="font-data-mono-sm text-data-mono-sm text-on-surface font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-primary">
                    {activeVehicle.type === 'Car' ? 'directions_car' : activeVehicle.type === 'Truck' ? 'local_shipping' : activeVehicle.type === 'Bus' ? 'directions_bus' : 'two_wheeler'}
                  </span>
                  {activeVehicle.classification}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Instantaneous Speed</span>
                <span className="font-data-mono-sm text-data-mono-sm text-primary font-bold">
                  {activeVehicle.speed.toFixed(1)} km/h
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Direction Vector</span>
                <span className="font-data-mono-sm text-data-mono-sm text-on-surface">
                  {activeVehicle.direction}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Track Duration</span>
                <span className="font-data-mono-sm text-data-mono-sm text-on-surface">
                  {activeVehicle.duration.toFixed(1)} seconds
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Path Curvature</span>
                <span className="font-data-mono-sm text-data-mono-sm text-on-surface">
                  {activeVehicle.curvature.toFixed(2)} rad/m
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Homography Error</span>
                <span className="font-data-mono-sm text-data-mono-sm text-tertiary">
                  ± {activeVehicle.homographyError.toFixed(2)} m
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-on-surface-variant">Collision Potential</span>
                <span className={`px-2 py-0.5 rounded font-label-caps text-label-caps font-bold ${
                  activeVehicle.collisionPotential === 'HIGH' 
                    ? 'bg-error/20 text-error' 
                    : activeVehicle.collisionPotential === 'MEDIUM' 
                    ? 'bg-amber-500/20 text-amber-300' 
                    : 'bg-tertiary/20 text-tertiary'
                }`}>
                  {activeVehicle.collisionPotential} ({activeVehicle.ttc} TTC)
                </span>
              </div>
            </div>
          </div>

          {/* Telemetry Actions */}
          <div className="flex flex-col gap-2 pt-space-sm border-t border-outline-variant/20">
            <div className="flex items-center justify-between text-[11px] font-data-mono-sm text-on-surface-variant">
              <span>Bounding Box Size:</span>
              <span>{activeVehicle.dimensions} • {activeVehicle.weightEst}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={handleExportCsv}
                className="py-1.5 px-2 rounded bg-surface-container-high text-on-surface font-label-caps text-label-caps uppercase hover:text-primary transition-colors flex items-center justify-center gap-1 border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-[14px]">timeline</span>
                Export CSV
              </button>
              <button 
                onClick={() => setIsLocked(!isLocked)}
                className={`py-1.5 px-2 rounded font-label-caps text-label-caps uppercase font-bold hover:shadow transition-all flex items-center justify-center gap-1 ${
                  isLocked ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">center_focus_strong</span>
                {isLocked ? 'Track Lock' : 'Unlock Track'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
