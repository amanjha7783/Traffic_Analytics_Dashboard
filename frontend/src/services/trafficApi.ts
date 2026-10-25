import axios from 'axios';
import type {
  RoadsListResponse,
  HourlyPatternResponse,
  WeekdayComparisonResponse,
  PeakHoursResponse,
  CongestionTrendsResponse,
  TwentyFourHourForecastResponse,
  TrafficAnalyticsSummary,
  ModelInfoResponse,
} from '../types';

const API_URL = 'http://localhost:8000/api';

export const fetchRoadSegments = async (): Promise<RoadsListResponse> => {
  const res = await axios.get(`${API_URL}/traffic/roads`);
  return res.data;
};

export const fetchAnalyticsSummary = async (): Promise<TrafficAnalyticsSummary> => {
  const res = await axios.get(`${API_URL}/traffic/analytics/summary`);
  return res.data;
};

export const fetchHourlyPattern = async (
  roadId: string,
  startDate?: string,
  endDate?: string,
  period?: string
): Promise<HourlyPatternResponse> => {
  const params: Record<string, string> = { road_segment_id: roadId };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (period && period !== 'All') params.period = period.toLowerCase();
  const res = await axios.get(`${API_URL}/traffic/analytics/hourly-pattern`, { params });
  return res.data;
};

export const fetchWeekdayComparison = async (
  roadId: string,
  startDate?: string,
  endDate?: string
): Promise<WeekdayComparisonResponse> => {
  const params: Record<string, string> = { road_segment_id: roadId };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const res = await axios.get(`${API_URL}/traffic/analytics/weekday-comparison`, { params });
  return res.data;
};

export const fetchPeakHours = async (
  roadId: string,
  startDate?: string,
  endDate?: string
): Promise<PeakHoursResponse> => {
  const params: Record<string, string> = { road_segment_id: roadId };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const res = await axios.get(`${API_URL}/traffic/analytics/peak-hours`, { params });
  return res.data;
};

export const fetchCongestionTrends = async (
  roadId?: string,
  startDate?: string,
  endDate?: string
): Promise<CongestionTrendsResponse> => {
  const params: Record<string, string> = {};
  if (roadId) params.road_segment_id = roadId;
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const res = await axios.get(`${API_URL}/traffic/analytics/congestion-trends`, { params });
  return res.data;
};

export const fetch24HourForecast = async (
  roadId: string,
  date?: string
): Promise<TwentyFourHourForecastResponse> => {
  const params: Record<string, string> = { road_segment_id: roadId };
  if (date) params.date = date;
  const res = await axios.get(`${API_URL}/traffic/24-hour`, { params });
  return res.data;
};

export const fetchModelInfo = async (): Promise<ModelInfoResponse> => {
  const res = await axios.get(`${API_URL}/traffic/model-info`);
  return res.data;
};
