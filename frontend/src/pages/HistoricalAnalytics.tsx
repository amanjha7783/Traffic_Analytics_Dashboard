import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  fetchRoadSegments,
  fetchAnalyticsSummary,
  fetchHourlyPattern,
  fetchWeekdayComparison,
  fetchPeakHours,
  fetchCongestionTrends,
} from '../services/trafficApi';
import type {
  RoadSegment,
  HourlyPattern,
  WeekdayComparison,
  PeakHourInfo,
  CongestionTrendPoint,
  TrafficAnalyticsSummary,
} from '../types';

export const HistoricalAnalytics: React.FC = () => {
  // Filters
  const [roadSegments, setRoadSegments] = useState<RoadSegment[]>([]);
  const [selectedRoadId, setSelectedRoadId] = useState<string>('RS-01');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Data States
  const [summary, setSummary] = useState<TrafficAnalyticsSummary | null>(null);
  const [hourlyPatterns, setHourlyPatterns] = useState<HourlyPattern[]>([]);
  const [weekdayComp, setWeekdayComp] = useState<WeekdayComparison[]>([]);
  const [morningPeaks, setMorningPeaks] = useState<number[]>([]);
  const [eveningPeaks, setEveningPeaks] = useState<number[]>([]);
  const [hourlyPeaks, setHourlyPeaks] = useState<PeakHourInfo[]>([]);
  const [congestionTrends, setCongestionTrends] = useState<CongestionTrendPoint[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load Roads on Mount
  useEffect(() => {
    const loadRoads = async () => {
      try {
        const resp = await fetchRoadSegments();
        setRoadSegments(resp.roads);
        if (resp.roads.length > 0) {
          setSelectedRoadId(resp.roads[0].road_segment_id);
        }
      } catch (err) {
        console.error('Error fetching roads:', err);
      }
    };
    loadRoads();
  }, []);

  // Fetch Analytics Data on Filter Change
  useEffect(() => {
    if (!selectedRoadId) return;

    const loadAnalytics = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const [sumData, hourlyData, weekData, peakData, trendData] = await Promise.all([
          fetchAnalyticsSummary(),
          fetchHourlyPattern(selectedRoadId, startDate, endDate, selectedPeriod),
          fetchWeekdayComparison(selectedRoadId, startDate, endDate),
          fetchPeakHours(selectedRoadId, startDate, endDate),
          fetchCongestionTrends(selectedRoadId, startDate, endDate),
        ]);

        setSummary(sumData);
        setHourlyPatterns(hourlyData.patterns);
        setWeekdayComp(weekData.comparison);
        setMorningPeaks(peakData.morning_peak_hours);
        setEveningPeaks(peakData.evening_peak_hours);
        setHourlyPeaks(peakData.hourly_details);
        setCongestionTrends(trendData.trends);
      } catch (err: any) {
        console.error('Error fetching historical analytics:', err);
        setErrorMsg('Failed to fetch historical traffic telemetry from backend.');
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [selectedRoadId, selectedPeriod, startDate, endDate]);

  const selectedRoad = roadSegments.find((r) => r.road_segment_id === selectedRoadId);

  return (
    <div className="flex flex-col gap-space-lg w-full pb-space-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-space-md bg-surface-container-low p-space-md lg:p-space-lg rounded-xl border border-outline-variant/20 shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
              Historical Traffic Analytics
            </span>
            <span className="px-2 py-0.5 rounded bg-tertiary-container/30 text-tertiary font-label-caps text-label-caps font-bold">
              MULTI-SENSOR TELEMETRY
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Empirical speed distributions, diurnal volume profiles, rush hour detection, and congestion indices
          </span>
        </div>

        {/* Data Provenance Badge */}
        <div className="px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30 text-xs font-mono text-on-surface-variant flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>Data Provenance: SIMULATED DEMO DATA</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface-container-low p-space-md rounded-xl border border-outline-variant/20 shadow-sm flex flex-wrap items-center justify-between gap-space-md">
        {/* Road Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-on-surface-variant">Monitored Corridor:</span>
          <select
            value={selectedRoadId}
            onChange={(e) => setSelectedRoadId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs font-medium focus:outline-none focus:border-primary"
          >
            {roadSegments.map((r) => (
              <option key={r.road_segment_id} value={r.road_segment_id}>
                {r.road_segment_id}: {r.road_name} ({r.road_length_km} km)
              </option>
            ))}
          </select>
        </div>

        {/* Time Period Filter */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-on-surface-variant mr-1 font-sans font-semibold">Time Period:</span>
          {['All', 'Morning', 'Afternoon', 'Evening'].map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                selectedPeriod === p
                  ? 'bg-primary text-on-primary font-bold'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-on-surface-variant font-semibold">Date Filter:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 rounded bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs"
          />
          <span className="text-on-surface-variant">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 rounded bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-primary hover:underline ml-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col">
            <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">
              Total Dataset Records
            </span>
            <span className="font-display-lg text-2xl font-bold text-on-surface mt-1">
              {summary.total_records.toLocaleString()}
            </span>
            <span className="text-[11px] text-on-surface-variant mt-0.5 font-mono">
              Across {summary.road_segments_count} monitored arterial corridors
            </span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col">
            <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">
              Average Network Speed
            </span>
            <span className="font-display-lg text-2xl font-bold text-primary mt-1">
              {summary.average_speed_kmh} <span className="text-sm font-normal">km/h</span>
            </span>
            <span className="text-[11px] text-on-surface-variant mt-0.5 font-mono">
              Avg Segment Travel Time: {summary.average_travel_time_seconds}s
            </span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col">
            <span className="font-label-caps text-[10px] text-amber-500 uppercase">
              Peak Traffic Hour
            </span>
            <span className="font-display-lg text-2xl font-bold text-amber-500 mt-1">
              {String(summary.peak_hour).padStart(2, '0')}:00
            </span>
            <span className="text-[11px] text-on-surface-variant mt-0.5 font-mono">
              Evening arterial peak period
            </span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col">
            <span className="font-label-caps text-[10px] text-tertiary uppercase">
              Busiest Segment
            </span>
            <span className="font-headline-sm text-base font-bold text-on-surface mt-1 truncate" title={summary.busiest_road}>
              {summary.busiest_road.split('(')[0]}
            </span>
            <span className="text-[11px] text-tertiary mt-0.5 font-mono">
              Avg Flow: {summary.average_volume} veh/h
            </span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-space-md rounded-xl bg-error/10 border border-error/30 text-error flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span className="text-sm">{errorMsg}</span>
        </div>
      )}

      {/* Row 1: Hourly Traffic Volume (Bar) & Speed (Line) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
        {/* Hourly Volume Chart */}
        <div className="p-space-lg rounded-xl bg-surface-container-low border border-outline-variant/20 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="font-headline-sm font-semibold text-on-surface">
                Hourly Traffic Volume (Flow Profile)
              </span>
              <span className="font-body-sm text-xs text-on-surface-variant">
                Unit: Vehicles per Hour (veh/h) across 24-hour cycle
              </span>
            </div>
            <span className="material-symbols-outlined text-primary text-[20px]">bar_chart</span>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyPatterns} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h) => `${h}:00`}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                />
                <YAxis
                  unit=" veh"
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                />
                <Tooltip
                  formatter={(val: any) => [`${Math.round(val)} veh/h`, 'Traffic Volume']}
                  labelFormatter={(h) => `Hour ${h}:00 - ${h}:59`}
                  contentStyle={{ backgroundColor: '#1c2028', borderColor: '#3d494c', color: '#fff' }}
                />
                <Bar dataKey="avg_volume" fill="#0284c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Average Speed Chart */}
        <div className="p-space-lg rounded-xl bg-surface-container-low border border-outline-variant/20 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="font-headline-sm font-semibold text-on-surface">
                Average Travel Speed Profile
              </span>
              <span className="font-body-sm text-xs text-on-surface-variant">
                Unit: Kilometers per Hour (km/h) with congestion dips during peak hours
              </span>
            </div>
            <span className="material-symbols-outlined text-tertiary text-[20px]">speed</span>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyPatterns} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h) => `${h}:00`}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                />
                <YAxis
                  unit=" km/h"
                  domain={[0, 'auto']}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toFixed(1)} km/h`, 'Average Speed']}
                  labelFormatter={(h) => `Hour ${h}:00 - ${h}:59`}
                  contentStyle={{ backgroundColor: '#1c2028', borderColor: '#3d494c', color: '#fff' }}
                />
                <Line
                  type="monotone"
                  dataKey="avg_speed_kmh"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Weekday vs Weekend & Peak Hour Detection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
        {/* Weekday vs Weekend Comparison (7 Cols) */}
        <div className="lg:col-span-7 p-space-lg rounded-xl bg-surface-container-low border border-outline-variant/20 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="font-headline-sm font-semibold text-on-surface">
                Weekday vs Weekend Comparison
              </span>
              <span className="font-body-sm text-xs text-on-surface-variant">
                Comparison of volume and speed dynamics on {selectedRoad?.road_name}
              </span>
            </div>
            <span className="material-symbols-outlined text-primary text-[20px]">calendar_view_week</span>
          </div>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayComp} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="category" tick={{ fontSize: 12, fill: 'currentColor', textTransform: 'capitalize' }} />
                <YAxis yAxisId="left" orientation="left" stroke="#0284c7" unit=" veh" />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" unit=" km/h" />
                <Tooltip contentStyle={{ backgroundColor: '#1c2028', borderColor: '#3d494c', color: '#fff' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="avg_volume" name="Avg Volume (veh/h)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="avg_speed_kmh" name="Avg Speed (km/h)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours Detection Digest (5 Cols) */}
        <div className="lg:col-span-5 p-space-lg rounded-xl bg-surface-container-low border border-outline-variant/20 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-headline-sm font-semibold text-on-surface">
                Peak Hour Detection
              </span>
              <span className="px-2 py-0.5 rounded bg-error/20 text-error font-label-caps text-[10px] font-bold">
                CONGESTION WINDOWS
              </span>
            </div>
            <span className="font-body-sm text-xs text-on-surface-variant">
              Automated threshold detection of peak demand periods
            </span>

            {/* Peak Windows Badges */}
            <div className="grid grid-cols-2 gap-space-sm my-2">
              <div className="p-space-sm rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-col">
                <span className="text-[10px] font-bold uppercase text-amber-500 font-mono">
                  Morning Rush Window
                </span>
                <span className="text-base font-bold text-on-surface mt-1">
                  {morningPeaks.map((h) => `${h}:00`).join(' - ')}
                </span>
                <span className="text-[10px] text-on-surface-variant mt-0.5 font-mono">Commuter Inflow Peak</span>
              </div>

              <div className="p-space-sm rounded-lg bg-error/10 border border-error/30 flex flex-col">
                <span className="text-[10px] font-bold uppercase text-error font-mono">
                  Evening Rush Window
                </span>
                <span className="text-base font-bold text-on-surface mt-1">
                  {eveningPeaks.map((h) => `${h}:00`).join(' - ')}
                </span>
                <span className="text-[10px] text-on-surface-variant mt-0.5 font-mono">Dispersal Outflow Peak</span>
              </div>
            </div>

            {/* Hourly Peak Details list */}
            <div className="flex flex-col gap-1.5 mt-1 max-h-36 overflow-y-auto pr-1">
              {hourlyPeaks
                .filter((p) => p.is_morning_peak || p.is_evening_peak)
                .map((p) => (
                  <div
                    key={p.hour}
                    className="p-2 rounded bg-surface-container flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${p.is_morning_peak ? 'bg-amber-400' : 'bg-error'}`}></span>
                      <span className="font-semibold text-on-surface">{p.hour}:00 - {p.hour}:59</span>
                    </div>
                    <div className="flex items-center gap-3 text-on-surface-variant">
                      <span>{Math.round(p.avg_volume)} veh/h</span>
                      <span className="font-bold text-primary">{p.avg_speed_kmh.toFixed(1)} km/h</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/20 text-[11px] text-on-surface-variant font-mono">
            Optimal Signal Offset: Reallocate +18s green time during detected rush hours.
          </div>
        </div>
      </div>

      {/* Row 3: Daily Congestion Trends Over Time */}
      <div className="p-space-lg rounded-xl bg-surface-container-low border border-outline-variant/20 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span className="font-headline-sm font-semibold text-on-surface">
              Daily Congestion Index Trend
            </span>
            <span className="font-body-sm text-xs text-on-surface-variant">
              Congestion Index = Free-flow speed / Observed speed (Index &gt; 1.0 represents speed degradation)
            </span>
          </div>
          <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
        </div>

        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={congestionTrends} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'currentColor' }} />
              <YAxis domain={[1.0, 'auto']} unit="x" tick={{ fontSize: 11, fill: 'currentColor' }} />
              <Tooltip
                formatter={(val: any) => [`${Number(val).toFixed(2)}x`, 'Congestion Index']}
                contentStyle={{ backgroundColor: '#1c2028', borderColor: '#3d494c', color: '#fff' }}
              />
              <Line
                type="monotone"
                dataKey="congestion_index"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
