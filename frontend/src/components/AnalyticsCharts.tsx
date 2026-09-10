import React, { useState } from 'react';

export const AnalyticsCharts: React.FC<{ data?: any[] }> = ({ data = [] }) => {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  
  const hasData = data && data.length > 0;
  const maxCount = hasData ? Math.max(...data.map(d => d.count)) : 98;
  const minCount = hasData ? Math.min(...data.map(d => d.count)) : 42;

  // Simple dynamic SVG points based on data (normalizing to 100 height)
  // Example points: "0,85 24,78 ..." 
  let pointsStr = "0,85 24,78 48,65 72,70 96,52 120,40 144,48 168,32 192,38 216,22 240,28";
  let lastX = 240, lastY = 28;
  
  if (hasData) {
    const pts = data.map((d, i) => {
       const x = Math.round((i / Math.max(1, data.length - 1)) * 240);
       const y = Math.round(100 - ((d.count / (maxCount * 1.2 || 1)) * 100));
       return `${x},${y}`;
    });
    pointsStr = pts.join(" ");
    if (pts.length > 0) {
      const lastPt = pts[pts.length - 1].split(',');
      lastX = parseInt(lastPt[0]);
      lastY = parseInt(lastPt[1]);
    }
  }

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
      {/* CHART A: Vehicles Over Time (Line Chart) */}
      <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between shadow-sm border border-outline-variant/10 hover:border-outline-variant/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Vehicles / Time
            </span>
            <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
              Flow rate per minute
            </span>
          </div>
          <span className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[16px]">show_chart</span>
          </span>
        </div>

        {/* Inline SVG Line Chart */}
        <div className="w-full h-32 flex items-center justify-center my-1">
          <svg className="w-full h-full select-none" viewBox="0 0 240 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="area-cyan" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#4cd7f6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#4cd7f6" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            <line x1="0" x2="240" y1="25" y2="25" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 2" />
            <line x1="0" x2="240" y1="50" y2="50" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 2" />
            <line x1="0" x2="240" y1="75" y2="75" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 2" />
            {/* Area Fill */}
            <polygon 
              points={`${pointsStr} 240,100 0,100`}
              fill="url(#area-cyan)" 
            />
            {/* Flow Line */}
            <polyline 
              points={pointsStr} 
              fill="none" 
              stroke="#4cd7f6" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
            />
            {/* High Peak Dot */}
            <circle cx={lastX} cy={lastY} r="3.5" fill="#4cd7f6" stroke="#0f131c" strokeWidth="2" />
          </svg>
        </div>

        <div className="flex items-center justify-between text-on-surface-variant font-data-mono-sm text-data-mono-sm pt-2 border-t border-outline-variant/10">
          <span>Min: {minCount} veh/m</span>
          <span className="text-primary font-semibold">Peak: {maxCount} veh/m</span>
        </div>
      </div>

      {/* CHART B: Average Speed Trend (Line Curve) */}
      <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between shadow-sm border border-outline-variant/10 hover:border-outline-variant/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Speed Trend
            </span>
            <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
              Velocity drop during queues
            </span>
          </div>
          <span className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-tertiary">
            <span className="material-symbols-outlined text-[16px]">speed</span>
          </span>
        </div>

        {/* Smoothed Speed Curve SVG */}
        <div className="w-full h-32 flex items-center justify-center my-1">
          <svg className="w-full h-full select-none" viewBox="0 0 240 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="area-speed" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#4edea3" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#4edea3" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <line x1="0" x2="240" y1="50" y2="50" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 2" />
            {/* Area */}
            <polygon 
              points="0,35 30,38 60,32 90,48 120,68 150,72 180,52 210,42 240,40 240,100 0,100" 
              fill="url(#area-speed)" 
            />
            {/* Line */}
            <path 
              d="M 0,35 Q 45,34 60,32 T 120,68 T 150,72 T 210,42 T 240,40" 
              fill="none" 
              stroke="#4edea3" 
              strokeWidth="2.5" 
            />
            {/* Congestion drop label */}
            <circle cx="150" cy="72" r="3.5" fill="#f59e0b" stroke="#0f131c" strokeWidth="2" />
            <text x="150" y="90" fill="#f59e0b" fontFamily="JetBrains Mono" fontSize="9" textAnchor="middle">
              Queue: 18km/h
            </text>
          </svg>
        </div>

        <div className="flex items-center justify-between text-on-surface-variant font-data-mono-sm text-data-mono-sm pt-2 border-t border-outline-variant/10">
          <span>Queue Delay: 4.2s</span>
          <span className="text-tertiary font-semibold">Free: 48 km/h</span>
        </div>
      </div>

      {/* CHART C: Vehicle Type Distribution (Donut Chart) */}
      <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between shadow-sm border border-outline-variant/10 hover:border-outline-variant/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Vehicle Mix
            </span>
            <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
              Class distribution
            </span>
          </div>
          <span className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[16px]">pie_chart</span>
          </span>
        </div>

        {/* Donut Chart & Legend */}
        <div className="flex items-center justify-between my-auto py-2">
          {/* SVG Donut */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 select-none" viewBox="0 0 36 36">
              {/* Cars: 62% (#4cd7f6) */}
              <circle 
                cx="18" 
                cy="18" 
                r="14" 
                fill="none" 
                stroke="#4cd7f6" 
                strokeWidth={hoveredSlice === 'Cars' ? "5.5" : "4.5"}
                strokeDasharray="62 38" 
                strokeDashoffset="0" 
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHoveredSlice('Cars')}
                onMouseLeave={() => setHoveredSlice(null)}
              />
              {/* Motorcycles: 18% (#4edea3) */}
              <circle 
                cx="18" 
                cy="18" 
                r="14" 
                fill="none" 
                stroke="#4edea3" 
                strokeWidth={hoveredSlice === 'Motos' ? "5.5" : "4.5"}
                strokeDasharray="18 82" 
                strokeDashoffset="-62" 
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHoveredSlice('Motos')}
                onMouseLeave={() => setHoveredSlice(null)}
              />
              {/* Trucks: 12% (#f59e0b) */}
              <circle 
                cx="18" 
                cy="18" 
                r="14" 
                fill="none" 
                stroke="#f59e0b" 
                strokeWidth={hoveredSlice === 'Trucks' ? "5.5" : "4.5"}
                strokeDasharray="12 88" 
                strokeDashoffset="-80" 
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHoveredSlice('Trucks')}
                onMouseLeave={() => setHoveredSlice(null)}
              />
              {/* Buses: 8% (#adc6ff) */}
              <circle 
                cx="18" 
                cy="18" 
                r="14" 
                fill="none" 
                stroke="#adc6ff" 
                strokeWidth={hoveredSlice === 'Buses' ? "5.5" : "4.5"}
                strokeDasharray="8 92" 
                strokeDashoffset="-92" 
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHoveredSlice('Buses')}
                onMouseLeave={() => setHoveredSlice(null)}
              />
            </svg>
            <div className="absolute flex flex-col items-center pointer-events-none">
              <span className="font-data-mono-sm text-[12px] font-bold text-on-surface">
                {hoveredSlice ? hoveredSlice : '247'}
              </span>
              <span className="font-label-caps text-[7px] text-on-surface-variant uppercase">
                {hoveredSlice ? 'Class' : 'Total'}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-1 font-body-sm text-[11px]">
            <div className="flex items-center gap-1.5 cursor-pointer" onMouseEnter={() => setHoveredSlice('Cars')} onMouseLeave={() => setHoveredSlice(null)}>
              <span className="w-2.5 h-2.5 rounded bg-primary"></span>
              <span className="text-on-surface">Cars: <span className="font-data-mono-sm font-semibold">62%</span></span>
            </div>
            <div className="flex items-center gap-1.5 cursor-pointer" onMouseEnter={() => setHoveredSlice('Motos')} onMouseLeave={() => setHoveredSlice(null)}>
              <span className="w-2.5 h-2.5 rounded bg-tertiary"></span>
              <span className="text-on-surface">Motos: <span className="font-data-mono-sm font-semibold">18%</span></span>
            </div>
            <div className="flex items-center gap-1.5 cursor-pointer" onMouseEnter={() => setHoveredSlice('Trucks')} onMouseLeave={() => setHoveredSlice(null)}>
              <span className="w-2.5 h-2.5 rounded bg-amber-400"></span>
              <span className="text-on-surface">Trucks: <span className="font-data-mono-sm font-semibold">12%</span></span>
            </div>
            <div className="flex items-center gap-1.5 cursor-pointer" onMouseEnter={() => setHoveredSlice('Buses')} onMouseLeave={() => setHoveredSlice(null)}>
              <span className="w-2.5 h-2.5 rounded bg-secondary"></span>
              <span className="text-on-surface">Buses: <span className="font-data-mono-sm font-semibold">8%</span></span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-on-surface-variant font-data-mono-sm text-data-mono-sm pt-2 border-t border-outline-variant/10">
          <span>YOLOv8 Conf: &gt; 0.88</span>
          <span className="text-primary font-medium">4 Classes</span>
        </div>
      </div>

      {/* CHART D: Movement Distribution (Bar Distribution) */}
      <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between shadow-sm border border-outline-variant/10 hover:border-outline-variant/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Maneuvers
            </span>
            <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
              Turn direction split
            </span>
          </div>
          <span className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[16px]">fork_right</span>
          </span>
        </div>

        {/* Horizontal Bar Stack */}
        <div className="flex flex-col gap-2.5 my-auto py-1">
          {/* Straight 54% */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-body-sm">
              <span className="text-on-surface font-medium">Straight Ahead</span>
              <span className="font-data-mono-sm font-bold text-primary">54% (133 veh)</span>
            </div>
            <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: '54%' }}></div>
            </div>
          </div>

          {/* Left Turn 29% */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-body-sm">
              <span className="text-on-surface font-medium">Left Turn (High Conflict)</span>
              <span className="font-data-mono-sm font-bold text-amber-400">29% (72 veh)</span>
            </div>
            <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
              <div className="bg-amber-400 h-full rounded-full" style={{ width: '29%' }}></div>
            </div>
          </div>

          {/* Right Turn 17% */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-body-sm">
              <span className="text-on-surface font-medium">Right Turn</span>
              <span className="font-data-mono-sm font-bold text-tertiary">17% (42 veh)</span>
            </div>
            <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
              <div className="bg-tertiary h-full rounded-full" style={{ width: '17%' }}></div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-on-surface-variant font-data-mono-sm text-data-mono-sm pt-2 border-t border-outline-variant/10">
          <span>Conflict Factor: Left Turn</span>
          <span className="text-amber-400 font-semibold">2.4x</span>
        </div>
      </div>
    </section>
  );
};
