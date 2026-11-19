import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { fetchRoadSegments, fetch24HourForecast, fetchModelInfo } from '../services/trafficApi';
import type { RoadSegment, HourlyForecast, ModelInfoResponse } from '../types';

export const TrafficForecast: React.FC = () => {
  const [roadSegments, setRoadSegments] = useState<RoadSegment[]>([]);
  const [selectedRoadId, setSelectedRoadId] = useState<string>('RS-01');
  const [forecastDate, setForecastDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [forecasts, setForecasts] = useState<HourlyForecast[]>([]);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  useEffect(() => {
    if (!selectedRoadId) return;

    const loadData = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const [fData, mData] = await Promise.all([
          fetch24HourForecast(selectedRoadId, forecastDate),
          fetchModelInfo(),
        ]);
        setForecasts(fData.forecasts);
        setModelInfo(mData);
      } catch (err: any) {
        console.error('Error fetching forecast:', err);
        setErrorMsg('Failed to load traffic forecast from backend.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedRoadId, forecastDate]);

  const selectedRoad = roadSegments.find((r) => r.road_segment_id === selectedRoadId);

  const morningData = forecasts.filter((f) => 7 <= f.hour && f.hour <= 11);
  const afternoonData = forecasts.filter((f) => 12 <= f.hour && f.hour <= 16);
  const eveningData = forecasts.filter((f) => 17 <= f.hour && f.hour <= 21);

  const avgSpd = (arr: HourlyForecast[]) =>
    arr.length ? (arr.reduce((acc, c) => acc + c.predicted_speed_kmh, 0) / arr.length).toFixed(1) : '--';

  const avgVol = (arr: HourlyForecast[]) =>
    arr.length ? Math.round(arr.reduce((acc, c) => acc + c.predicted_volume, 0) / arr.length) : '--';

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Top Banner Toolbar */}
      <div className="p-3.5 rounded border border-outline-variant bg-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[18px]">trending_up</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-on-surface">
                Predictive Traffic Velocity & Travel-Time Engine
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-surface-container-high text-on-surface-variant border border-outline-variant">
                ML INFERENCE
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Chronological supervised learning predictions benchmarking travel times, velocity profiles, and bottleneck probability
            </p>
          </div>
        </div>

        {modelInfo?.model_type && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded border border-outline-variant bg-surface-container-low text-xs font-mono text-on-surface-variant">
            <span>Model:</span>
            <span className="text-on-surface font-semibold">{modelInfo.model_type.split('(')[0].trim()}</span>
          </div>
        )}
      </div>

      {/* Control Filters Toolbar */}
      <div className="p-3.5 rounded border border-outline-variant bg-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-mono uppercase font-semibold text-on-surface-variant">
              Road Corridor:
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

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-mono uppercase font-semibold text-on-surface-variant">
              Target Date:
            </label>
            <input
              type="date"
              value={forecastDate}
              onChange={(e) => setForecastDate(e.target.value)}
              className="px-2.5 py-1.5 rounded bg-surface-container-low border border-outline-variant text-on-surface text-xs font-medium focus:outline-none focus:border-primary cursor-pointer"
            />
          </div>
        </div>

        {selectedRoad && (
          <div className="text-xs font-mono text-on-surface-variant flex items-center gap-3">
            <span>Length: <strong className="text-on-surface">{selectedRoad.road_length_km} km</strong></span>
            <span>Limit: <strong className="text-on-surface">{selectedRoad.speed_limit_kmh} km/h</strong></span>
            <span>Capacity: <strong className="text-on-surface">{selectedRoad.capacity_vph} veh/h</strong></span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 rounded border border-danger/40 bg-surface text-danger text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {isLoading && (
        <div className="p-6 text-center text-on-surface-variant flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary animate-spin">sync</span>
          <span className="text-xs font-medium">Computing 24-hour predictive forecast...</span>
        </div>
      )}

      {/* Diurnal Period Comparison Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Morning Inflow */}
        <div className="p-3 rounded border border-outline-variant bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
            <span className="font-mono text-[11px] font-semibold uppercase text-warning">
              Morning Inflow (07:00 – 11:00)
            </span>
            <span className="material-symbols-outlined text-[16px] text-warning">wb_sunny</span>
          </div>
          <div className="grid grid-cols-2 gap-2 my-2.5">
            <div>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Avg Speed</span>
              <div className="text-sm font-semibold font-mono text-on-surface mt-0.5">{avgSpd(morningData)} km/h</div>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Avg Throughput</span>
              <div className="text-sm font-semibold font-mono text-warning mt-0.5">{avgVol(morningData)} veh/h</div>
            </div>
          </div>
          <span className="text-[10px] text-on-surface-variant font-mono">Morning commuter inflow</span>
        </div>

        {/* Afternoon Inter-Peak */}
        <div className="p-3 rounded border border-outline-variant bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
            <span className="font-mono text-[11px] font-semibold uppercase text-success">
              Mid-Day Inter-Peak (12:00 – 16:00)
            </span>
            <span className="material-symbols-outlined text-[16px] text-success">wb_twilight</span>
          </div>
          <div className="grid grid-cols-2 gap-2 my-2.5">
            <div>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Avg Speed</span>
              <div className="text-sm font-semibold font-mono text-on-surface mt-0.5">{avgSpd(afternoonData)} km/h</div>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Avg Throughput</span>
              <div className="text-sm font-semibold font-mono text-success mt-0.5">{avgVol(afternoonData)} veh/h</div>
            </div>
          </div>
          <span className="text-[10px] text-on-surface-variant font-mono">Mid-day stable baseline transit</span>
        </div>

        {/* Evening Rush */}
        <div className="p-3 rounded border border-outline-variant bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
            <span className="font-mono text-[11px] font-semibold uppercase text-danger">
              Evening Rush (17:00 – 21:00)
            </span>
            <span className="material-symbols-outlined text-[16px] text-danger">bedtime</span>
          </div>
          <div className="grid grid-cols-2 gap-2 my-2.5">
            <div>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Avg Speed</span>
              <div className="text-sm font-semibold font-mono text-danger mt-0.5">{avgSpd(eveningData)} km/h</div>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Avg Throughput</span>
              <div className="text-sm font-semibold font-mono text-danger mt-0.5">{avgVol(eveningData)} veh/h</div>
            </div>
          </div>
          <span className="text-[10px] text-on-surface-variant font-mono">Evening peak dispersal window</span>
        </div>
      </div>

      {/* Chart 1: 24-Hour Predicted Travel Time Curve */}
      <div className="p-4 rounded border border-outline-variant bg-surface flex flex-col">
        <div className="flex items-center justify-between mb-3 border-b border-outline-variant pb-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface">
              Predicted Segment Travel Time Across 24 Hours
            </h2>
            <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">
              Metric: seconds (s) for {selectedRoad?.road_name} ({selectedRoad?.road_length_km} km) &bull; Amber/Red bands highlight peak intervals
            </p>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-outline-variant bg-surface-container-low text-on-surface-variant">
            24H PROFILE
          </span>
        </div>

        <div className="w-full h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecasts} margin={{ top: 10, right: 15, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="var(--color-outline-variant)" opacity={0.5} />
              <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
              <YAxis unit="s" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
              <Tooltip
                formatter={(val: any) => [`${Number(val).toFixed(1)}s`, 'Predicted Travel Time']}
                labelFormatter={(h) => `Hour: ${h}:00`}
                contentStyle={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-outline)',
                  borderRadius: '4px',
                  color: 'var(--color-on-surface)',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
              />
              <ReferenceArea x1={8} x2={10} fill="#C58A24" fillOpacity={0.15} />
              <ReferenceArea x1={17} x2={20} fill="#C44848" fillOpacity={0.15} />
              <Line
                type="monotone"
                dataKey="predicted_travel_time_seconds"
                stroke="#315B8A"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#315B8A' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Dual Column: Speed Profile vs Throughput Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Predicted Speed */}
        <div className="p-4 rounded border border-outline-variant bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-outline-variant pb-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface">
                Predicted Velocity Profile
              </h2>
              <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">
                Metric: km/h (Design limit: {selectedRoad?.speed_limit_kmh} km/h)
              </p>
            </div>
            <span className="material-symbols-outlined text-[16px] text-success">speed</span>
          </div>

          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecasts} margin={{ top: 10, right: 15, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--color-outline-variant)" opacity={0.5} />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <YAxis unit=" km/h" domain={[0, 'auto']} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toFixed(1)} km/h`, 'Predicted Velocity']}
                  labelFormatter={(h) => `Hour: ${h}:00`}
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-outline)',
                    borderRadius: '4px',
                    color: 'var(--color-on-surface)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                />
                {selectedRoad && (
                  <ReferenceLine
                    y={selectedRoad.speed_limit_kmh}
                    stroke="#C44848"
                    strokeDasharray="4 4"
                    label={{ value: 'Limit', fill: '#C44848', fontSize: 10, position: 'top' }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="predicted_speed_kmh"
                  stroke="#16845B"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#16845B' }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Predicted Volume */}
        <div className="p-4 rounded border border-outline-variant bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-outline-variant pb-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface">
                Hourly Throughput Volume
              </h2>
              <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">
                Metric: Vehicles per hour (veh/h)
              </p>
            </div>
            <span className="material-symbols-outlined text-[16px] text-primary">traffic</span>
          </div>

          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecasts} margin={{ top: 10, right: 15, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--color-outline-variant)" opacity={0.5} />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <YAxis unit=" veh" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <Tooltip
                  formatter={(val: any) => [`${Math.round(val)} veh/h`, 'Hourly Flow Rate']}
                  labelFormatter={(h) => `Hour: ${h}:00`}
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-outline)',
                    borderRadius: '4px',
                    color: 'var(--color-on-surface)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                />
                <Bar dataKey="predicted_volume" fill="#729CCB" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Model Performance Telemetry Card */}
      {modelInfo && (
        <div className="p-4 rounded border border-outline-variant bg-surface flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-outline-variant pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface">
                Inference Engine Validation & Architecture
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-success/15 text-success border border-success/30">
              CROSS-VALIDATED
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Algorithm</span>
              <span className="text-xs font-semibold font-mono text-on-surface mt-1 truncate" title={modelInfo.model_type}>
                {modelInfo.model_type.split('(')[0]}
              </span>
            </div>

            <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Test MAE</span>
              <span className="text-xs font-semibold font-mono text-primary mt-1">
                {modelInfo.mae === null ? 'N/A' : `${modelInfo.mae}s`}
              </span>
            </div>

            <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Test RMSE</span>
              <span className="text-xs font-semibold font-mono text-on-surface mt-1">
                {modelInfo.rmse === null ? 'N/A' : `${modelInfo.rmse}s`}
              </span>
            </div>

            <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Train Records</span>
              <span className="text-xs font-semibold font-mono text-success mt-1">
                {modelInfo.training_records.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-3 rounded border border-outline-variant bg-surface-container-low text-[11px] font-mono text-on-surface-variant flex flex-col gap-1.5">
            <div className="flex flex-wrap justify-between gap-1">
              <span className="font-semibold text-on-surface">Features:</span>
              <span>{modelInfo.features_used.join(', ')}</span>
            </div>
            <div className="pt-1.5 border-t border-outline-variant/50 text-[10px]">
              Provenance: {modelInfo.note}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
