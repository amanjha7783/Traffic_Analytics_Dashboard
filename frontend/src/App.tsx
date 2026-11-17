import React, { useState, useEffect } from 'react';
import { NavTab } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { KpiRow } from './components/KpiRow';
import { VideoPlayerFeed } from './components/VideoPlayerFeed';
import { TrajectoriesSection } from './components/TrajectoriesSection';
import { RiskHeatmapSection } from './components/RiskHeatmapSection';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { TrafficMonitorDashboard } from './components/TrafficMonitorDashboard';
import { ReportsView } from './components/ReportsView';
import { SettingsModal } from './components/SettingsModal';
import { RoutePlanner } from './pages/RoutePlanner';
import { HistoricalAnalytics } from './pages/HistoricalAnalytics';
import { TrafficForecast } from './pages/TrafficForecast';
import { fetchSummary, fetchVehiclesOverTime, fetchTrajectories } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Real API State
  const [summaryData, setSummaryData] = useState<any>({});
  const [chartData, setChartData] = useState<any[]>([]);
  const [trajectoriesData, setTrajectoriesData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const sumData = await fetchSummary();
        const timeData = await fetchVehiclesOverTime();
        const trajData = await fetchTrajectories();
        
        const latestPositions = new Map();
        if (Array.isArray(trajData)) {
            trajData.forEach((pt: any) => {
                latestPositions.set(pt.vehicle_id, pt);
            });
        }
        
        const mappedTracks = Array.from(latestPositions.values()).map((d: any) => ({
            id: String(d.vehicle_id),
            type: String(d.vehicle_type || 'UNKNOWN'),
            timestamp: Number(d.timestamp),
            x: Number(d.x),
            y: Number(d.y),
            speed: Number.isFinite(Number(d.speed)) ? Number(d.speed) : undefined,
        }));

        setSummaryData(sumData);
        setChartData(timeData);
        setTrajectoriesData(mappedTracks);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching data from backend", err);
        setApiError("Unable to load traffic analytics. Please check the backend connection.");
        setIsLoading(false);
      }
    };
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface antialiased flex transition-colors duration-300">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Header
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
        />

        <main className="relative w-full bg-background px-space-md lg:px-gutter-lg py-space-lg">
          {apiError && ['trajectories', 'analytics', 'risk-heatmap'].includes(activeTab) ? (
             <div className="w-full p-space-xl bg-surface-container-low rounded-xl border border-error/20 flex flex-col items-center justify-center text-center">
                 <span className="material-symbols-outlined text-[48px] text-error mb-4">error</span>
                 <h2 className="font-headline-lg text-headline-lg text-on-surface">{apiError}</h2>
                 <p className="text-on-surface-variant mt-2 font-body-lg">Verify that the FastAPI server is running on http://localhost:8000.</p>
             </div>
          ) : isLoading && ['trajectories', 'analytics', 'risk-heatmap'].includes(activeTab) ? (
             <div className="w-full flex items-center justify-center p-space-2xl text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-[32px] text-primary">sync</span>
                <span className="ml-4 font-headline-sm">Loading traffic data...</span>
             </div>
          ) : activeTab === 'overview' && (
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-space-lg pb-space-2xl">
              <VideoPlayerFeed onOpenTrafficMonitor={() => setActiveTab('traffic-monitor')} />
            </div>
          )}

          {/* Render other tabs */}
          {!isLoading && activeTab === 'traffic-monitor' && (
            <div className="flex flex-col w-full pb-space-2xl">
              <TrafficMonitorDashboard />
            </div>
          )}

          {!isLoading && !apiError && activeTab === 'trajectories' && (
            <div className="flex flex-col w-full gap-space-lg pb-space-2xl">
              <TrajectoriesSection
                vehicleTracks={trajectoriesData}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={setSelectedVehicleId}
              />
            </div>
          )}
          
          {!isLoading && !apiError && activeTab === 'risk-heatmap' && (
            <div className="flex flex-col w-full gap-space-lg pb-space-2xl">
              <RiskHeatmapSection
                onViewRiskBreakdown={() => setActiveTab('reports')}
              />
            </div>
          )}

          {!isLoading && !apiError && activeTab === 'analytics' && (
            <div className="flex flex-col w-full gap-space-lg pb-space-2xl">
              <KpiRow 
                 totalVehicles={summaryData.total_vehicles}
                 avgSpeed={summaryData.average_speed}
              />
              <AnalyticsCharts data={chartData} />
            </div>
          )}

          {activeTab === 'route-planner' && (
            <RoutePlanner />
          )}

          {activeTab === 'traffic-forecast' && (
            <TrafficForecast />
          )}

          {activeTab === 'historical-analytics' && (
            <HistoricalAnalytics />
          )}

          {!isLoading && !apiError && activeTab === 'reports' && (
             <ReportsView />
          )}

        </main>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
