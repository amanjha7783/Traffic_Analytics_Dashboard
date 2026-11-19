import React, { useState, useEffect } from 'react';
import { NavTab } from '../types';

interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  activeTab: NavTab;
}

const TAB_METADATA: Record<NavTab, { section: string; title: string; subtitle: string }> = {
  'overview': {
    section: 'Operations & Control',
    title: 'Operational Overview',
    subtitle: 'Real-time telemetry, classification counters & CCTV inference feed',
  },
  'video-intelligence': {
    section: 'Video Intelligence & GIS',
    title: 'Video Intelligence Studio',
    subtitle: 'Multi-camera CCTV analysis, homography calibration, physical measurements & trajectory exports',
  },
  'traffic-monitor': {
    section: 'Operations & Control',
    title: 'Traffic Monitor',
    subtitle: 'Dual-camera surveillance, homography calibration & virtual tripwires',
  },
  'route-planner': {
    section: 'Routing & Prediction',
    title: 'GIS Route Planner',
    subtitle: 'Corridor geocoding, multi-criteria pathfinding & turn-by-turn navigation',
  },
  'traffic-forecast': {
    section: 'Routing & Prediction',
    title: 'Traffic Forecast Engine',
    subtitle: '24-hour diurnal velocity forecasting, throughput curves & ML metrics',
  },
  'historical-analytics': {
    section: 'Telemetry & Audit',
    title: 'Historical Analytics',
    subtitle: 'Corridor volume analysis, temporal congestion windows & speed distributions',
  },
  'trajectories': {
    section: 'Telemetry & Audit',
    title: 'Spatial Trajectories',
    subtitle: 'Coordinate logging, instantaneous pixel velocities & telemetry export',
  },
  'analytics': {
    section: 'Telemetry & Audit',
    title: 'Telemetry KPIs',
    subtitle: 'Aggregate flow metrics, speed distributions & tracking longevity',
  },
  'reports': {
    section: 'Telemetry & Audit',
    title: 'Audit & Reports',
    subtitle: 'Telemetry session logs, CSV/JSON exports & processed video records',
  },
};

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  theme,
  onToggleTheme,
  activeTab,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const meta = TAB_METADATA[activeTab] || {
    section: 'System',
    title: 'TrafficOps Command',
    subtitle: 'Intelligent Transportation Management Platform',
  };

  return (
    <header className="sticky top-0 w-full h-14 bg-surface border-b border-outline-variant z-30 px-3 sm:px-4 lg:px-6 flex items-center justify-between transition-colors duration-150">
      <div className="flex items-center gap-3 min-w-0">
        {/* Sidebar Toggle Button */}
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded border border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer flex items-center justify-center shrink-0"
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={isSidebarOpen ? 'Collapse sidebar navigation' : 'Expand sidebar navigation'}
        >
          <span className="material-symbols-outlined text-[20px]">
            {isSidebarOpen ? 'menu_open' : 'menu'}
          </span>
        </button>

        {/* Enterprise Breadcrumb & Title */}
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span className="font-semibold text-primary">TrafficOps</span>
            <span className="text-[10px] text-on-surface-variant/50">/</span>
            <span className="hidden sm:inline text-on-surface-variant">{meta.section}</span>
            <span className="hidden sm:inline text-[10px] text-on-surface-variant/50">/</span>
            <span className="font-medium text-on-surface truncate">{meta.title}</span>
          </div>
          <span className="hidden md:inline-block text-[11px] text-on-surface-variant truncate">
            {meta.subtitle}
          </span>
        </div>
      </div>

      {/* Right Telemetry & Controls */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Backend Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border border-outline-variant bg-surface-container-low text-[11px] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
          <span className="text-on-surface-variant font-medium">CORE 8000</span>
        </div>

        {/* Real-time System Clock */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-outline-variant bg-surface-container-low text-xs font-mono text-on-surface font-semibold tracking-wider">
          <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
          <span>{currentTime || '00:00:00'}</span>
          <span className="text-[10px] text-on-surface-variant font-normal">IST</span>
        </div>

        {/* Theme Switcher Button */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 rounded border border-outline-variant bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer flex items-center justify-center"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle visual theme"
        >
          {theme === 'dark' ? (
            <span className="material-symbols-outlined text-[18px] text-amber-400">light_mode</span>
          ) : (
            <span className="material-symbols-outlined text-[18px] text-primary">dark_mode</span>
          )}
        </button>
      </div>
    </header>
  );
};
