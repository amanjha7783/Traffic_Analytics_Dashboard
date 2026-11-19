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
      if (startDate && endDate && startDate > endDate) {
        setIsLoading(false);
        setErrorMsg('Start date must be on or before end date.');
        return;
      }
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
    <div className="flex flex-col gap-4 w-full">
      {/* Header Banner */}
      <div className="p-3.5 rounded border border-outline-variant bg-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[18px]">analytics</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-on-surface">
                Historical Traffic Archive & Congestion Analysis
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-surface-container-high text-on-surface-variant border border-outline-variant">
                EMPIRICAL DB
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Empirical speed distributions, diurnal volume profiles, rush hour detection, and corridor congestion metrics
            </p>
          </div>
        </div>

        {summary?.data_source && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded border border-outline-variant bg-surface-container-low text-xs font-mono text-on-surface-variant">
            <span>Archive Source:</span>
            <span className="text-on-surface font-semibold">{summary.data_source}</span>
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="p-3.5 rounded border border-outline-variant bg-surface flex flex-wrap items-center justify-between gap-3">
        {/* Road Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="text-[11px] font-mono uppercase font-semibold text-on-surface-variant">
            Corridor:
          </label>
          <select
            value={selectedRoadId}
            onChange={(e) => setSelectedRoadId(e.target.value)}
            className="px-2.5 py-1.5 rounded bg-surface-container-low border border-outline-variant text-on-surface text-xs font-medium focus:outline-none focus:border-primary cursor-pointer"
          >
            {roadSegments.map((r) => (
              <option key={r.road_segment_id} value={r.road_segment_id}>
                {r.road_segment_id}: {r.road_name} ({r.road_length_km} km)
              </option>
            ))}
          </select>
        </div>

        {/* Time Period Filter Buttons */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono uppercase font-semibold text-on-surface-variant mr-1">
            Period:
          </span>
          {['All', 'Morning', 'Afternoon', 'Evening'].map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer border ${
                selectedPeriod === p
                  ? 'bg-primary/10 border-primary text-primary font-semibold'
                  : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Date Span Filters */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase font-semibold text-on-surface-variant">
            Span:
          </span>
          <input
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 rounded bg-surface-container-low border border-outline-variant text-on-surface text-xs font-medium focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-on-surface-variant font-mono">&ndash;</span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 rounded bg-surface-container-low border border-outline-variant text-on-surface text-xs font-medium focus:outline-none focus:border-primary"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="px-2 py-1 rounded border border-outline-variant bg-surface-container-low text-primary text-xs hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded border border-outline-variant bg-surface flex flex-col">
            <span className="text-[10px] text-on-surface-variant font-mono uppercase">Total Database Records</span>
            <span className="text-base font-semibold font-mono text-on-surface mt-1">
              {summary.total_records.toLocaleString()}
            </span>
            <span className="text-[10px] text-on-surface-variant mt-0.5">
              Across {summary.road_segments_count} monitored corridors
            </span>
          </div>

          <div className="p-3 rounded border border-outline-variant bg-surface flex flex-col">
            <span className="text-[10px] text-on-surface-variant font-mono uppercase">Network Avg Velocity</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base font-semibold font-mono text-primary">
                {summary.average_speed_kmh}
              </span>
              <span className="text-[10px] text-on-surface-variant">km/h</span>
            </div>
            <span className="text-[10px] text-on-surface-variant mt-0.5">
              Avg Segment Time: {summary.average_travel_time_seconds}s
            </span>
          </div>

          <div className="p-3 rounded border border-outline-variant bg-surface flex flex-col">
            <span className="text-[10px] text-on-surface-variant font-mono uppercase">Peak Traffic Hour</span>
            <span className="text-base font-semibold font-mono text-warning mt-1">
              {String(summary.peak_hour).padStart(2, '0')}:00
            </span>
            <span className="text-[10px] text-on-surface-variant mt-0.5">
              Diurnal max volume concentration
            </span>
          </div>

          <div className="p-3 rounded border border-outline-variant bg-surface flex flex-col">
            <span className="text-[10px] text-on-surface-variant font-mono uppercase">Busiest Corridor</span>
            <span className="text-xs font-semibold text-on-surface mt-1 truncate" title={summary.busiest_road}>
              {summary.busiest_road.split('(')[0]}
            </span>
            <span className="text-[10px] font-mono text-success mt-0.5">
              Avg Flow: {summary.average_volume} veh/h
            </span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded border border-danger/40 bg-surface text-danger text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {isLoading && (
        <div className="p-6 text-center text-on-surface-variant flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary animate-spin">sync</span>
          <span className="text-xs font-medium">Querying historical database metrics...</span>
        </div>
      )}

      {/* Row 1: Hourly Volume & Velocity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly Volume Chart */}
        <div className="p-4 rounded border border-outline-variant bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-outline-variant pb-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface">
                Hourly Flow Profile (Volume)
              </h2>
              <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">
                Vehicles per Hour (veh/h) across diurnal cycle
              </p>
            </div>
            <span className="material-symbols-outlined text-[16px] text-primary">bar_chart</span>
          </div>

          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyPatterns} margin={{ top: 10, right: 15, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--color-outline-variant)" opacity={0.5} />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <YAxis unit=" veh" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <Tooltip
                  formatter={(val: any) => [`${Math.round(val)} veh/h`, 'Traffic Volume']}
                  labelFormatter={(h) => `Hour ${h}:00 - ${h}:59`}
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-outline)',
                    borderRadius: '4px',
                    color: 'var(--color-on-surface)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                />
                <Bar dataKey="avg_volume" fill="#315B8A" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Velocity Chart */}
        <div className="p-4 rounded border border-outline-variant bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-outline-variant pb-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface">
                Hourly Velocity Profile (Speed)
              </h2>
              <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">
                Observed corridor velocity in km/h
              </p>
            </div>
            <span className="material-symbols-outlined text-[16px] text-success">speed</span>
          </div>

          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyPatterns} margin={{ top: 10, right: 15, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--color-outline-variant)" opacity={0.5} />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <YAxis unit=" km/h" domain={[0, 'auto']} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toFixed(1)} km/h`, 'Average Speed']}
                  labelFormatter={(h) => `Hour ${h}:00 - ${h}:59`}
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-outline)',
                    borderRadius: '4px',
                    color: 'var(--color-on-surface)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avg_speed_kmh"
                  stroke="#16845B"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#16845B' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Weekday vs Weekend Comparison & Peak Hour Digest */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Weekday vs Weekend Comparison (7 Cols) */}
        <div className="lg:col-span-7 p-4 rounded border border-outline-variant bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-outline-variant pb-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface">
                Weekday vs Weekend Comparison
              </h2>
              <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">
                Volume and velocity shift between workdays and weekends on {selectedRoad?.road_name}
              </p>
            </div>
            <span className="material-symbols-outlined text-[16px] text-primary">calendar_view_week</span>
          </div>

          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayComp} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--color-outline-variant)" opacity={0.5} />
                <XAxis dataKey="category" tick={{ fontSize: 12, fill: 'var(--color-on-surface)', fontWeight: 500 }} />
                <YAxis yAxisId="left" orientation="left" stroke="#315B8A" unit=" veh" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#16845B" unit=" km/h" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-outline)',
                    borderRadius: '4px',
                    color: 'var(--color-on-surface)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: 6, fontSize: 11, fontFamily: 'monospace' }} />
                <Bar yAxisId="left" dataKey="avg_volume" name="Flow (veh/h)" fill="#315B8A" radius={[2, 2, 0, 0]} />
                <Bar yAxisId="right" dataKey="avg_speed_kmh" name="Velocity (km/h)" fill="#16845B" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours Detection Digest (5 Cols) */}
        <div className="lg:col-span-5 p-4 rounded border border-outline-variant bg-surface flex flex-col justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface">
                Algorithmic Peak Hour Windows
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-warning/15 text-warning border border-warning/30">
                ACTIVE
              </span>
            </div>

            {/* Peak Windows Badges */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low flex flex-col">
                <span className="text-[10px] font-mono uppercase font-semibold text-warning">
                  Morning Inflow
                </span>
                <span className="text-sm font-semibold font-mono text-on-surface mt-0.5">
                  {morningPeaks.length ? morningPeaks.map((h) => `${h}:00`).join(' - ') : '08:00 - 10:00'}
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono">Commuter Window</span>
              </div>

              <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low flex flex-col">
                <span className="text-[10px] font-mono uppercase font-semibold text-danger">
                  Evening Rush
                </span>
                <span className="text-sm font-semibold font-mono text-on-surface mt-0.5">
                  {eveningPeaks.length ? eveningPeaks.map((h) => `${h}:00`).join(' - ') : '17:00 - 19:00'}
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono">Dispersal Window</span>
              </div>
            </div>

            {/* Identified Congestion Slots */}
            <div>
              <div className="text-[11px] font-mono uppercase font-semibold text-on-surface-variant mb-1.5">
                Identified Congestion Intervals
              </div>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
                {hourlyPeaks
                  .filter((p) => p.is_morning_peak || p.is_evening_peak)
                  .map((p) => (
                    <div
                      key={p.hour}
                      className="p-2 rounded border border-outline-variant bg-surface-container-low flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${p.is_morning_peak ? 'bg-warning' : 'bg-danger'}`}></span>
                        <span className="font-semibold text-on-surface">{p.hour}:00 &ndash; {p.hour}:59</span>
                      </div>
                      <div className="flex items-center gap-3 text-on-surface-variant text-[11px]">
                        <span>{Math.round(p.avg_volume)} veh/h</span>
                        <span className="font-semibold text-primary">{p.avg_speed_kmh.toFixed(1)} km/h</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Daily Congestion Trends Over Time */}
      <div className="p-4 rounded border border-outline-variant bg-surface flex flex-col">
        <div className="flex items-center justify-between mb-3 border-b border-outline-variant pb-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface">
              Daily Congestion Index Trend
            </h2>
            <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">
              Congestion Index = Free-flow speed &divide; Observed speed (Values &gt; 1.0 denote speed degradation)
            </p>
          </div>
          <span className="material-symbols-outlined text-[16px] text-warning">trending_up</span>
        </div>

        <div className="w-full h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={congestionTrends} margin={{ top: 10, right: 15, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="var(--color-outline-variant)" opacity={0.5} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
              <YAxis domain={[1.0, 'auto']} unit="x" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
              <Tooltip
                formatter={(val: any) => [`${Number(val).toFixed(2)}x`, 'Congestion Index']}
                contentStyle={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-outline)',
                  borderRadius: '4px',
                  color: 'var(--color-on-surface)',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
              />
              <Line
                type="monotone"
                dataKey="congestion_index"
                stroke="#C58A24"
                strokeWidth={2}
                dot={{ r: 2.5, fill: '#C58A24' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
