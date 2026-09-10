import React, { useState } from 'react';

interface RiskHeatmapSectionProps {
  onViewRiskBreakdown?: () => void;
}

export const RiskHeatmapSection: React.FC<RiskHeatmapSectionProps> = ({
  onViewRiskBreakdown,
}) => {
  const [viewMode, setViewMode] = useState<'map' | 'heatmap' | 'overlay'>('overlay');
  const [opacity, setOpacity] = useState<number>(70);

  const mapUrl = "/assets/images/intersection-map.jpeg";
  const heatmapUrl = "/assets/images/traffic-risk-heatmap.jpeg";

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
      {/* LEFT / CENTER: Overlay Heatmap View (8 COLS) */}
      <div className="lg:col-span-8 flex flex-col bg-surface-container-low rounded-xl overflow-hidden shadow-md border border-outline-variant/10">
        {/* Section Header with Mode Switcher */}
        <div className="p-space-md bg-surface-container flex flex-wrap items-center justify-between gap-space-sm border-b border-outline-variant/20">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Traffic Risk Heatmap
              </span>
              <span className="px-2 py-0.5 rounded bg-error/15 text-error font-label-caps text-label-caps font-bold uppercase">
                HOTSPOT DETECTION
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Spatial distribution of traffic concentration and potential conflict zones
            </span>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="flex items-center p-1 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
            <button 
              onClick={() => setViewMode('map')}
              className={`px-2.5 py-1 rounded font-label-caps text-label-caps uppercase transition-colors ${
                viewMode === 'map' 
                  ? 'bg-primary-container text-on-primary-container font-bold shadow-sm' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              MAP VIEW
            </button>
            <button 
              onClick={() => setViewMode('heatmap')}
              className={`px-2.5 py-1 rounded font-label-caps text-label-caps uppercase transition-colors ${
                viewMode === 'heatmap' 
                  ? 'bg-primary-container text-on-primary-container font-bold shadow-sm' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              HEATMAP VIEW
            </button>
            <button 
              onClick={() => setViewMode('overlay')}
              className={`px-2.5 py-1 rounded font-label-caps text-label-caps uppercase transition-colors ${
                viewMode === 'overlay' 
                  ? 'bg-primary-container text-on-primary-container font-bold shadow-sm' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              OVERLAY
            </button>
          </div>
        </div>

        {/* Interactive Screen Graphic Container */}
        <div className="relative w-full aspect-[16/9] min-h-[360px] bg-surface-container-lowest overflow-hidden flex select-none">
          
          {/* Base Map Layer */}
          {(viewMode === 'map' || viewMode === 'overlay') && (
            <div 
              className="absolute inset-0 w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url('${mapUrl}')` }}
            />
          )}
          
          {/* Heatmap Layer */}
          {(viewMode === 'heatmap' || viewMode === 'overlay') && (
            <div 
              className="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-200 mix-blend-screen"
              style={{ 
                backgroundImage: `url('${heatmapUrl}')`,
                opacity: viewMode === 'overlay' ? opacity / 100 : 1 
              }}
            />
          )}

          {/* HUD Badges */}
          <div className="absolute top-3 left-3 px-2 py-1 rounded bg-surface-container-lowest/80 backdrop-blur-md font-label-caps text-label-caps uppercase text-on-surface border border-outline-variant/20 shadow-sm z-10">
            {viewMode === 'map' ? 'LANE TOPOLOGY • CAM 01 FULL VIEW' : 
             viewMode === 'heatmap' ? 'AI RISK ANALYSIS FULL VIEW' : 
             'LANE TOPOLOGY + RISK OVERLAY'}
          </div>

          {viewMode !== 'map' && (
            <div className="absolute top-3 right-3 px-2 py-1 rounded bg-surface-container-lowest/80 backdrop-blur-md font-label-caps text-label-caps uppercase text-error flex items-center gap-1.5 border border-error/20 shadow-sm z-10">
              <span className="h-1.5 w-1.5 rounded-full bg-error animate-ping"></span>
              <span>AI RISK OVERLAY • {viewMode === 'overlay' ? `${opacity}%` : '100%'}</span>
            </div>
          )}
        </div>

        {/* Controls & Thermal Gradient Legend Footer */}
        <div className="px-space-md py-space-sm bg-surface-container flex flex-wrap items-center justify-between gap-space-sm border-t border-outline-variant/20">
          {/* Opacity Slider */}
          <div className="flex items-center gap-space-sm">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Heatmap Opacity:
            </span>
            <input 
              type="range"
              min="10"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              disabled={viewMode !== 'overlay'}
              className="w-32 h-1.5 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-cyan-400 disabled:opacity-50"
            />
            <span className="font-data-mono-sm text-data-mono-sm text-primary font-semibold w-8">
              {opacity}%
            </span>
          </div>

          {/* Thermal Scale Legend */}
          <div className="flex items-center gap-2">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Risk Intensity:
            </span>
            <span className="font-data-mono-sm text-[11px] text-primary">LOW</span>
            <div className="w-36 h-2 rounded bg-gradient-to-r from-primary via-amber-400 to-error"></div>
            <span className="font-data-mono-sm text-[11px] text-error font-bold">HIGH RISK</span>
          </div>
        </div>

        {/* Bottom Footnote */}
        <div className="px-space-md py-1.5 bg-surface-container-low text-on-surface-variant font-body-sm text-[12px] flex flex-wrap items-center justify-between border-t border-outline-variant/10">
          <span>
            Prototype Risk Heatmap • AI-generated spatial risk analysis based on trajectory density and deceleration variance
          </span>
        </div>
      </div>

      {/* RIGHT / SIDE: Risk Insights & Hotspot Breakdown Panel (4 COLS) */}
      <div className="lg:col-span-4 flex flex-col justify-between bg-surface-container-low rounded-xl p-space-md lg:p-space-lg shadow-md border border-outline-variant/10">
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Risk Analysis
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Collision Hotspot Digest
              </span>
            </div>
            <span className="px-2 py-1 rounded bg-error/20 text-error font-label-caps text-label-caps font-bold uppercase border border-error/30">
              ELEVATED
            </span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container flex items-center justify-between border border-outline-variant/10">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                Overall Risk Score
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-display-lg text-display-lg font-bold text-error">
                  64
                </span>
                <span className="font-data-mono-md text-data-mono-md text-on-surface-variant">
                  / 100
                </span>
              </div>
              <span className="font-data-mono-sm text-data-mono-sm text-amber-400 mt-0.5">
                Status: Moderate-High
              </span>
            </div>

            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path 
                  className="text-surface-container-highest" 
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3.5" 
                />
                <path 
                  className="text-error" 
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeDasharray="64, 100" 
                  strokeLinecap="round" 
                  strokeWidth="3.5" 
                />
              </svg>
              <span className="absolute material-symbols-outlined text-[20px] text-error">
                warning
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-error/10 border border-error/20 flex flex-col items-center text-center">
              <span className="font-headline-sm text-headline-sm font-bold text-error">4</span>
              <span className="font-label-caps text-[9px] uppercase text-error font-semibold mt-0.5">
                High Risk
              </span>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex flex-col items-center text-center">
              <span className="font-headline-sm text-headline-sm font-bold text-amber-300">7</span>
              <span className="font-label-caps text-[9px] uppercase text-amber-300 font-semibold mt-0.5">
                Medium Risk
              </span>
            </div>
            <div className="p-2 rounded-lg bg-tertiary/10 border border-tertiary/20 flex flex-col items-center text-center">
              <span className="font-headline-sm text-headline-sm font-bold text-tertiary">12</span>
              <span className="font-label-caps text-[9px] uppercase text-tertiary font-semibold mt-0.5">
                Low Risk
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between font-label-caps text-label-caps text-on-surface-variant">
              <span>LOW (0-35)</span>
              <span>MED (36-70)</span>
              <span>HIGH (71-100)</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container-highest relative overflow-hidden">
              <div className="h-full bg-gradient-to-r from-tertiary via-amber-400 to-error w-full"></div>
              <div className="absolute top-0 bottom-0 w-1.5 bg-on-surface shadow" style={{ left: '64%' }}></div>
            </div>
          </div>
        </div>

        <button 
          onClick={onViewRiskBreakdown}
          className="mt-space-md w-full py-2.5 px-space-md rounded-lg bg-surface-container-high text-on-surface font-body-md font-semibold flex items-center justify-center gap-2 hover:bg-surface-container-highest hover:text-primary transition-colors border border-outline-variant/20"
        >
          <span>View Full Risk Breakdown</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </section>
  );
};
