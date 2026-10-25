import React, { useState, useEffect } from 'react';
import { NavTab, CameraStream } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { KpiRow } from './components/KpiRow';
import { VideoPlayerFeed } from './components/VideoPlayerFeed';
import { TrajectoriesSection } from './components/TrajectoriesSection';
import { RiskHeatmapSection } from './components/RiskHeatmapSection';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { AiInsightsSection } from './components/AiInsightsSection';
import { OverviewTrajectoriesSummary } from './components/OverviewTrajectoriesSummary';
import { TrafficMonitorView } from './components/TrafficMonitorView';
import { ReportsView } from './components/ReportsView';
import { SettingsModal } from './components/SettingsModal';
import { RoutePlanner } from './pages/RoutePlanner';
import { HistoricalAnalytics } from './pages/HistoricalAnalytics';
import { TrafficForecast } from './pages/TrafficForecast';
import { fetchSummary, fetchVehiclesOverTime, fetchTrajectories } from './services/api';

const MOCK_CAMERAS: CameraStream[] = [
  { 
    id: 'cam-01', 
    name: 'Junction 67 (Eastbound Quad)', 
    junction: 'J-67',
    code: 'CAM-01',
    status: 'ONLINE', 
    rtspUrl: 'rtsp://10.0.1.67/stream1', 
    resolution: '1080p', 
    fps: 30.2, 
    latencyMs: 24,
    imageUrl: '/assets/images/intersection-map.jpeg'
  },
  { 
    id: 'cam-02', 
    name: 'Junction 67 (Westbound)', 
    junction: 'J-67',
    code: 'CAM-02',
    status: 'ONLINE', 
    rtspUrl: 'rtsp://10.0.1.67/stream2', 
    resolution: '720p', 
    fps: 28.4, 
    latencyMs: 18,
    imageUrl: '/assets/images/traffic-risk-heatmap.jpeg'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [currentCamera, setCurrentCamera] = useState<CameraStream>(MOCK_CAMERAS[0]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('V-024');
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
            id: `V-${d.vehicle_id}`,
            type: d.vehicle_type === 1 ? 'Car' : d.vehicle_type === 2 ? 'Truck' : 'Moto',
            classification: 'Standard',
            speed: d.speed || 45,
            confidence: 0.95,
            direction: 'N/A',
            duration: 12.4,
            curvature: 0.01,
            homographyError: 0.12,
            collisionPotential: (d.speed > 80) ? 'HIGH' : 'LOW',
            ttc: 9.9,
            dimensions: '4.2m x 1.8m',
            weightEst: '1.4t',
            bbox: {
                left: `${Math.min(95, Math.max(0, (d.x / 1920) * 100))}%`,
                top: `${Math.min(95, Math.max(0, (d.y / 1080) * 100))}%`,
                width: '4%',
                height: '6%'
            },
            color: '#4cd7f6'
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
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const flowRate = Math.round((summaryData.total_vehicles || 0) / 3);
  const density = Math.min(100, Math.round((summaryData.total_vehicles || 0) * 1.5));
  const conflictPoints = summaryData.risk_level === 'High' ? 4 : summaryData.risk_level === 'Medium' ? 2 : 0;
  
  const getTrafficStatusLabel = () => {
    if (density < 40) return { label: 'Normal Flow', color: 'text-tertiary', dot: 'bg-tertiary' };
    if (density < 75) return { label: 'Moderate Traffic', color: 'text-amber-500', dot: 'bg-amber-500' };
    return { label: 'High Congestion', color: 'text-error', dot: 'bg-error' };
  };
  const trafficStatus = getTrafficStatusLabel();

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
          currentCamera={currentCamera}
          allCameras={MOCK_CAMERAS}
          onSelectCamera={setCurrentCamera}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
        />

        <main className="relative w-full bg-background px-space-md lg:px-gutter-lg py-space-lg">
          {apiError && ['overview', 'trajectories', 'analytics', 'risk-heatmap', 'traffic-monitor'].includes(activeTab) ? (
             <div className="w-full p-space-xl bg-surface-container-low rounded-xl border border-error/20 flex flex-col items-center justify-center text-center">
                 <span className="material-symbols-outlined text-[48px] text-error mb-4">error</span>
                 <h2 className="font-headline-lg text-headline-lg text-on-surface">{apiError}</h2>
                 <p className="text-on-surface-variant mt-2 font-body-lg">Verify that the FastAPI server is running on http://localhost:8000.</p>
             </div>
          ) : isLoading && ['overview', 'trajectories', 'analytics', 'risk-heatmap', 'traffic-monitor'].includes(activeTab) ? (
             <div className="w-full flex items-center justify-center p-space-2xl text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-[32px] text-primary">sync</span>
                <span className="ml-4 font-headline-sm">Loading traffic data...</span>
             </div>
          ) : activeTab === 'overview' && (
            <div className="flex flex-col w-full gap-space-lg pb-space-2xl">
              
              <KpiRow 
                 totalVehicles={summaryData.total_vehicles}
                 activeTracks={summaryData.active_tracks}
                 avgSpeed={summaryData.average_speed}
                 riskScore={summaryData.risk_score}
                 trafficDensity={density}
                 conflictZones={conflictPoints}
              />

              {/* LIVE TRAFFIC FEED */}
              <div className="flex flex-col">
                <VideoPlayerFeed
                  currentCamera={currentCamera}
                  vehicleTracks={trajectoriesData}
                  selectedVehicleId={selectedVehicleId}
                  onSelectVehicle={setSelectedVehicleId}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
                {/* CURRENT TRAFFIC STATUS */}
                <div className="bg-surface-container-low p-space-lg rounded-xl border border-outline-variant/20 shadow-sm flex flex-col">
                  <span className="font-headline-md text-on-surface font-semibold mb-4">Current Traffic Status</span>
                  <div className="flex items-center gap-2 mb-6">
                    <span className={`w-3 h-3 rounded-full ${trafficStatus.dot}`}></span>
                    <span className={`font-headline-sm font-bold ${trafficStatus.color}`}>{trafficStatus.label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <span className="text-on-surface-variant text-sm mb-1">Density</span>
                      <span className="font-display-lg text-on-surface">{density}%</span>
                    </div>
                    <div className="flex flex-col border-l border-outline-variant/20 pl-4">
                      <span className="text-on-surface-variant text-sm mb-1">Speed</span>
                      <span className="font-display-lg text-on-surface">{summaryData.average_speed?.toFixed(1) || '--'}</span>
                    </div>
                    <div className="flex flex-col border-l border-outline-variant/20 pl-4">
                      <span className="text-on-surface-variant text-sm mb-1">Flow</span>
                      <span className="font-display-lg text-on-surface">{flowRate || '--'}</span>
                    </div>
                  </div>
                </div>

                {/* COLLISION RISK */}
                <div className="bg-surface-container-low p-space-lg rounded-xl border border-outline-variant/20 shadow-sm flex flex-col">
                  <span className="font-headline-md text-on-surface font-semibold mb-4">Collision Risk</span>
                  <div className="grid grid-cols-3 gap-4 h-full">
                    <div className="flex flex-col">
                      <span className="text-on-surface-variant text-sm mb-1">Risk Score</span>
                      <span className="font-display-lg text-amber-500 font-bold">{summaryData.risk_score || '--'} <span className="text-sm font-normal text-on-surface-variant">/ 100</span></span>
                    </div>
                    <div className="flex flex-col border-l border-outline-variant/20 pl-4">
                      <span className="text-on-surface-variant text-sm mb-1">Conflict Points</span>
                      <span className="font-display-lg text-on-surface">{conflictPoints}</span>
                    </div>
                    <div className="flex flex-col border-l border-outline-variant/20 pl-4">
                      <span className="text-on-surface-variant text-sm mb-1">TTC Alerts</span>
                      <span className="font-display-lg text-on-surface">2</span>
                    </div>
                  </div>
                </div>
              </div>

              <RiskHeatmapSection
                onViewRiskBreakdown={() => setActiveTab('reports')}
              />

              <OverviewTrajectoriesSummary 
                vehicleTracks={trajectoriesData}
                onViewTrajectories={() => setActiveTab('trajectories')}
              />

              <AiInsightsSection 
                onViewAnalytics={() => setActiveTab('analytics')}
              />
            </div>
          )}

          {/* Render other tabs */}
          {!isLoading && !apiError && activeTab === 'traffic-monitor' && (
            <div className="flex flex-col w-full pb-space-2xl">
              <TrafficMonitorView
                cameras={MOCK_CAMERAS}
                currentCamera={currentCamera}
                onSelectCamera={setCurrentCamera}
                vehicleTracks={trajectoriesData}
              />
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
                 activeTracks={summaryData.active_tracks}
                 avgSpeed={summaryData.average_speed}
                 riskScore={summaryData.risk_score}
                 trafficDensity={density}
                 conflictZones={conflictPoints}
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
