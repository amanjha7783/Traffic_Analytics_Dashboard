import React, { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import TopHeader from '../components/layout/TopHeader';
import KPICard from '../components/KPICard';
import TrafficVideo from '../components/TrafficVideo';
import HeatmapViewer from '../components/HeatmapViewer';
import TrajectoryMap from '../components/TrajectoryMap';
import AnalyticsCharts from '../components/AnalyticsCharts';
import { fetchSummary, fetchVehiclesOverTime, fetchTrajectories } from '../services/api';

export default function Dashboard() {
  const [summary, setSummary] = useState({});
  const [chartData, setChartData] = useState([]);
  const [trajectories, setTrajectories] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const sumData = await fetchSummary();
        setSummary(sumData);

        const timeData = await fetchVehiclesOverTime();
        setChartData(timeData);

        const trajData = await fetchTrajectories();
        setTrajectories(trajData);
      } catch (err) {
        console.error("Error fetching data", err);
      }
    };
    loadData();
  }, []);

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      <Sidebar />
      <div className="pl-64">
        <TopHeader />
        
        <main className="relative w-full pt-16 px-gutter-lg py-space-lg">
          <div className="flex flex-col w-full gap-space-lg pb-space-2xl">
            
            {/* 1. TOP KPI SUMMARY ROW */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md">
              <KPICard 
                title="Total Vehicles" 
                value={summary.total_vehicles} 
                iconName="directions_car"
                subtitle="Tracked cumulative"
                trend="+12%"
                trendLabel="Last 10 min"
                highlightBarColor="from-primary to-transparent"
              />
              <KPICard 
                title="Active Tracks" 
                value={summary.active_tracks} 
                colorClass="tertiary"
                subtitle="ByteTrack v2.1"
                trend="LIVE"
                trendLabel="0 loss"
                highlightBarColor="from-tertiary to-transparent"
              />
              <KPICard 
                title="Avg. Speed" 
                value={summary.average_speed} 
                unit="km/h"
                iconName="speed"
                subtitle="Across active"
                trendLabel="Normal Flow"
                highlightBarColor="from-secondary-container to-transparent"
              />
              <KPICard 
                title="Traffic Density" 
                value={summary.total_vehicles ? Math.min(100, Math.round(summary.total_vehicles * 1.5)) : 0} 
                unit="%"
                subtitle="Current Occupancy"
                highlightBarColor="from-amber-400 to-transparent"
              />
              <KPICard 
                title="Conflict Zones" 
                value={summary.risk_level === 'High' ? 4 : summary.risk_level === 'Medium' ? 2 : 0} 
                colorClass="error"
                iconName="crisis_alert"
                subtitle="TTC < 1.5s alerts"
                trend={`Score: ${summary.risk_score}/100`}
                trendLabel="Junction 67"
                highlightBarColor="from-error to-transparent"
              />
            </section>

            {/* 2. MAIN STORY: VIDEO + OVERVIEW ROW */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
              <div className="lg:col-span-8 flex flex-col bg-surface-container-low rounded-xl overflow-hidden shadow-md">
                <TrafficVideo />
              </div>
              <div className="lg:col-span-4 flex flex-col justify-between bg-surface-container-low rounded-xl p-space-lg shadow-md">
                <AnalyticsCharts data={chartData} />
              </div>
            </section>

            {/* 3. VEHICLE TRAJECTORIES */}
            <section className="flex flex-col bg-surface-container-low rounded-xl p-space-lg shadow-md gap-space-md">
              <TrajectoryMap trajectories={trajectories} />
            </section>

            {/* 4. MAP + PROTOTYPE RISK HEATMAP SECTION */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
              <div className="lg:col-span-8 flex flex-col bg-surface-container-low rounded-xl overflow-hidden shadow-md">
                <HeatmapViewer />
              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}
