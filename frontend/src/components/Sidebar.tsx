import React from 'react';
import { NavTab } from '../types';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenSettings: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSettings,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems: { id: NavTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'route-planner', label: 'Route Planner', icon: 'directions' },
    { id: 'traffic-forecast', label: 'Traffic Forecast', icon: 'trending_up' },
    { id: 'historical-analytics', label: 'Historical Analytics', icon: 'analytics' },
    { id: 'traffic-monitor', label: 'Traffic Monitor', icon: 'videocam' },
    { id: 'trajectories', label: 'Trajectories', icon: 'timeline' },
    { id: 'risk-heatmap', label: 'Risk Heatmap', icon: 'crisis_alert' },
    { id: 'analytics', label: 'Analytics', icon: 'query_stats' },
    { id: 'reports', label: 'Reports', icon: 'description' },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}

      <aside 
        id="app-sidebar"
        className={`fixed left-0 top-0 h-full w-64 bg-surface-container-lowest z-50 flex flex-col justify-between border-r border-outline-variant/30 transition-transform duration-300 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          {/* Logo & Brand Header */}
          <div className="h-16 px-space-md flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-space-sm">
              <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                <span className="material-symbols-outlined text-[20px]">radar</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface">
                  Traffic Analytics
                </span>
                <span className="font-label-caps text-label-caps text-primary uppercase">
                  CV Intelligence v2.4
                </span>
              </div>
            </div>
            {/* Close button on mobile */}
            <button 
              onClick={onCloseMobile}
              className="lg:hidden text-on-surface-variant hover:text-on-surface p-1"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 p-space-sm mt-space-sm">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`flex items-center gap-space-sm px-space-md py-space-sm transition-all text-left ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container font-semibold rounded-lg shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                      : 'rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {item.icon}
                  </span>
                  <span className="font-body-md text-body-md">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom CV Health Status Box */}
        <div className="p-space-sm border-t border-outline-variant/20 bg-surface-container-lowest">
          <div className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
                </span>
                <span className="font-label-caps text-label-caps uppercase text-tertiary font-bold tracking-wider">
                  Processing Ready
                </span>
              </div>
              <button 
                id="sidebar-settings-btn"
                onClick={onOpenSettings}
                className="text-on-surface-variant hover:text-primary transition-colors flex items-center p-1"
                title="CV Pipeline Settings"
              >
                <span className="material-symbols-outlined text-[16px]">settings</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-on-surface-variant font-data-mono-sm text-data-mono-sm pt-space-xs border-t border-outline-variant/20">
              <span>Pipeline Latency:</span>
              <span className="text-primary font-semibold">24ms</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
