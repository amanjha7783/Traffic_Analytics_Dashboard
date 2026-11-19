import React from 'react';
import { NavTab } from '../types';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenTrafficMonitor: () => void;
  isOpen: boolean;
  onClose: () => void;
  onToggle?: () => void;
}

interface NavGroup {
  label: string;
  items: {
    id: NavTab;
    label: string;
    icon: string;
    badge?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenTrafficMonitor,
  isOpen,
  onClose,
}) => {
  const navGroups: NavGroup[] = [
    {
      label: 'Operations & Control',
      items: [
        { id: 'overview', label: 'Operational Overview', icon: 'dashboard' },
        { id: 'video-intelligence', label: 'Video Intelligence', icon: 'smart_display' },
        { id: 'traffic-monitor', label: 'Traffic Monitor', icon: 'videocam', badge: 'LIVE' },
      ],
    },
    {
      label: 'Routing & Prediction',
      items: [
        { id: 'route-planner', label: 'Route Planner', icon: 'alt_route' },
        { id: 'traffic-forecast', label: 'Traffic Forecast', icon: 'trending_up', badge: 'ML' },
      ],
    },
    {
      label: 'Telemetry & Audit',
      items: [
        { id: 'historical-analytics', label: 'Historical Analytics', icon: 'analytics' },
        { id: 'trajectories', label: 'Spatial Trajectories', icon: 'timeline' },
        { id: 'analytics', label: 'Telemetry KPIs', icon: 'query_stats' },
        { id: 'reports', label: 'Audit Reports', icon: 'description' },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs transition-opacity duration-150"
          onClick={onClose}
        />
      )}

      <aside 
        id="app-sidebar"
        className={`fixed left-0 top-0 h-full w-64 bg-surface-container-low z-50 flex flex-col justify-between border-r border-outline-variant shadow-subtle transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col min-h-0 overflow-y-auto">
          {/* Logo & Platform Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-outline-variant bg-surface shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                <span className="material-symbols-outlined text-[18px]">traffic</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm tracking-tight text-on-surface truncate">
                    TrafficOps
                  </span>
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant">
                    GSV
                  </span>
                </div>
                <span className="text-[10px] text-on-surface-variant truncate">
                  Transportation Operations Center
                </span>
              </div>
            </div>

            {/* Collapse toggle */}
            <button 
              onClick={onClose}
              className="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors cursor-pointer"
              title="Collapse Sidebar"
              aria-label="Collapse sidebar"
            >
              <span className="material-symbols-outlined text-[20px]">menu_open</span>
            </button>
          </div>

          {/* Grouped Navigation Links */}
          <nav className="flex flex-col gap-4 p-3">
            {navGroups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <span className="px-2.5 text-[10px] font-mono uppercase font-semibold text-on-surface-variant tracking-wider">
                  {group.label}
                </span>
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`nav-${item.id}`}
                      onClick={() => {
                        onSelectTab(item.id);
                        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                          onClose();
                        }
                      }}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded text-xs font-medium transition-colors cursor-pointer text-left ${
                        isActive
                          ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60 border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`material-symbols-outlined text-[18px] shrink-0 ${
                          isActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'
                        }`}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold uppercase ${
                          isActive 
                            ? 'bg-primary text-white' 
                            : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Industrial System Telemetry Status Box */}
        <div className="p-3 border-t border-outline-variant bg-surface shrink-0">
          <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success"></span>
                <span className="text-[11px] font-medium text-on-surface">
                  Core Ingest Active
                </span>
              </div>
              <button 
                id="sidebar-configure-sources-btn"
                onClick={onOpenTrafficMonitor}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Configure
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant pt-1.5 border-t border-outline-variant/60">
              <span>Telemetry Feed:</span>
              <span className="text-on-surface font-medium">Local 127.0.0.1</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
