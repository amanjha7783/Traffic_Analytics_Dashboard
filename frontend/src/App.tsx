import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { NavTab } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { KpiRow } from './components/KpiRow';
import { VideoPlayerFeed } from './components/VideoPlayerFeed';
import { TrajectoriesSection } from './components/TrajectoriesSection';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { TrafficMonitorDashboard } from './components/TrafficMonitorDashboard';
import { ReportsView } from './components/ReportsView';
import { RoutePlanner } from './pages/RoutePlanner';
import { HistoricalAnalytics } from './pages/HistoricalAnalytics';
import { TrafficForecast } from './pages/TrafficForecast';
import { fetchSummary, fetchVehiclesOverTime, fetchTrajectories } from './services/api';

// Video Intelligence Simplified Workflow Pages
import { ProjectListPage } from './pages/video-intelligence/ProjectListPage';
import { SimpleProjectWorkspace } from './pages/video-intelligence/SimpleProjectWorkspace';
import { ProjectHistoryPage } from './pages/video-intelligence/ProjectHistoryPage';
import { VideoSetupPage } from './pages/video-intelligence/VideoSetupPage';
import { VideoProcessingPage } from './pages/video-intelligence/VideoProcessingPage';
import { SimpleVideoAnalyticsPage } from './pages/video-intelligence/SimpleVideoAnalyticsPage';

const getActiveTabFromPath = (pathname: string): NavTab => {
  if (pathname.startsWith('/video-intelligence')) return 'video-intelligence';
  if (pathname.startsWith('/traffic-monitor')) return 'traffic-monitor';
  if (pathname.startsWith('/route-planner')) return 'route-planner';
  if (pathname.startsWith('/traffic-forecast')) return 'traffic-forecast';
  if (pathname.startsWith('/historical-analytics')) return 'historical-analytics';
  if (pathname.startsWith('/trajectories')) return 'trajectories';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/reports')) return 'reports';
  return 'overview';
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getActiveTabFromPath(location.pathname);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  // Sidebar State (Persistent & Responsive)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_open');
      if (saved !== null) return saved === 'true';
      return window.innerWidth >= 1024;
    }
    return true;
  });

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_open', String(next));
      return next;
    });
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    localStorage.setItem('sidebar_open', 'false');
  };

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Real Telemetry API State for legacy tabs
  const [summaryData, setSummaryData] = useState<any>({});
  const [chartData, setChartData] = useState<any[]>([]);
  const [trajectoriesData, setTrajectoriesData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [sumData, timeData, trajData] = await Promise.all([
          fetchSummary(),
          fetchVehiclesOverTime(),
          fetchTrajectories(),
        ]);
        if (!active) return;

        const mappedTracks = (Array.isArray(trajData) ? trajData : []).map((d: any) => ({
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
        setApiError(null);
        setIsLoading(false);
      } catch (err) {
        if (!active) return;
        console.error('Error fetching data from backend', err);
        setApiError('Unable to load traffic analytics. Please check the backend connection.');
        setIsLoading(false);
      }
    };
    void loadData();
    const interval = setInterval(loadData, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface antialiased flex transition-colors duration-300">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => navigate('/' + tab)}
        onOpenTrafficMonitor={() => navigate('/traffic-monitor')}
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        onToggle={toggleSidebar}
      />

      <div
        className={`flex-1 ${
          isSidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
        } flex flex-col min-w-0 transition-all duration-200 ease-in-out`}
      >
        <Header
          onToggleSidebar={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          activeTab={activeTab}
        />

        <main className="relative w-full bg-background px-3 sm:px-4 lg:px-6 py-4">
          <Routes>
            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/overview" replace />} />

            {/* Existing Primary Tabs */}
            <Route
              path="/overview"
              element={
                <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-6 pb-12">
                  <VideoPlayerFeed onOpenTrafficMonitor={() => navigate('/traffic-monitor')} />
                </div>
              }
            />

            <Route
              path="/traffic-monitor"
              element={
                <div className="mx-auto flex flex-col w-full max-w-[1720px] pb-12">
                  <TrafficMonitorDashboard />
                </div>
              }
            />

            <Route
              path="/route-planner"
              element={
                <div className="mx-auto w-full max-w-[1720px]">
                  <RoutePlanner />
                </div>
              }
            />

            <Route
              path="/traffic-forecast"
              element={
                <div className="mx-auto w-full max-w-[1720px]">
                  <TrafficForecast />
                </div>
              }
            />

            <Route
              path="/historical-analytics"
              element={
                <div className="mx-auto w-full max-w-[1720px]">
                  <HistoricalAnalytics />
                </div>
              }
            />

            <Route
              path="/trajectories"
              element={
                apiError ? (
                  <div className="w-full p-6 lg:p-8 bg-surface-container-low rounded border border-danger/40 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded bg-danger/10 border border-danger/30 flex items-center justify-center text-danger mb-3">
                      <span className="material-symbols-outlined text-[28px]">warning</span>
                    </div>
                    <h2 className="text-base font-semibold text-on-surface">{apiError}</h2>
                    <p className="text-on-surface-variant mt-1 text-xs max-w-md">
                      Verify that the FastAPI backend server is running on http://127.0.0.1:8000.
                    </p>
                  </div>
                ) : isLoading ? (
                  <div className="w-full flex flex-col items-center justify-center p-12 text-on-surface-variant">
                    <span className="material-symbols-outlined animate-spin text-[32px] text-primary">
                      progress_activity
                    </span>
                    <span className="mt-3 text-sm font-semibold text-on-surface">Synchronizing Traffic Data...</span>
                  </div>
                ) : (
                  <div className="mx-auto flex flex-col w-full max-w-[1720px] gap-6 pb-12">
                    <TrajectoriesSection
                      vehicleTracks={trajectoriesData}
                      selectedVehicleId={selectedVehicleId}
                      onSelectVehicle={setSelectedVehicleId}
                    />
                  </div>
                )
              }
            />

            <Route
              path="/analytics"
              element={
                apiError ? (
                  <div className="w-full p-6 lg:p-8 bg-surface-container-low rounded border border-danger/40 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded bg-danger/10 border border-danger/30 flex items-center justify-center text-danger mb-3">
                      <span className="material-symbols-outlined text-[28px]">warning</span>
                    </div>
                    <h2 className="text-base font-semibold text-on-surface">{apiError}</h2>
                  </div>
                ) : (
                  <div className="mx-auto flex flex-col w-full max-w-[1720px] gap-6 pb-12">
                    <KpiRow totalVehicles={summaryData.total_vehicles} avgSpeed={summaryData.average_speed} />
                    <AnalyticsCharts data={chartData} />
                  </div>
                )
              }
            />

            <Route
              path="/reports"
              element={
                <div className="mx-auto w-full max-w-[1720px]">
                  <ReportsView />
                </div>
              }
            />

            {/* Video Intelligence Distinct Workflow Routes */}
            {/* 1. Project Listing */}
            <Route path="/video-intelligence" element={<ProjectListPage />} />

            {/* 2. Project Workspace (Upload + History button ONLY) */}
            <Route path="/video-intelligence/projects/:projectId" element={<SimpleProjectWorkspace />} />

            {/* 3. Project History */}
            <Route path="/video-intelligence/projects/:projectId/history" element={<ProjectHistoryPage />} />

            {/* 4. Video Setup & Calibration */}
            <Route
              path="/video-intelligence/projects/:projectId/videos/:videoId/setup"
              element={<VideoSetupPage />}
            />

            {/* 5. Processing Monitor */}
            <Route
              path="/video-intelligence/projects/:projectId/videos/:videoId/processing/:jobId"
              element={<VideoProcessingPage />}
            />

            {/* 6. Video Analytics Page */}
            <Route
              path="/video-intelligence/projects/:projectId/videos/:videoId/analytics"
              element={<SimpleVideoAnalyticsPage />}
            />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
