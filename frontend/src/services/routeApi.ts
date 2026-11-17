import axios from 'axios';
import type { RouteRequest, RouteEstimateResponse } from '../types';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api`;

export const estimateRoute = async (params: RouteRequest): Promise<RouteEstimateResponse> => {
  const res = await axios.post(`${API_URL}/route/estimate`, params);
  return res.data;
};
