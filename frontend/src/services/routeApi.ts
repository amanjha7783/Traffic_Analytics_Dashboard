import axios from 'axios';
import type { RouteRequest, RouteEstimateResponse } from '../types';
import { API_ORIGIN } from './trafficApi';

const API_URL = `${API_ORIGIN}/api`;

export const estimateRoute = async (params: RouteRequest): Promise<RouteEstimateResponse> => {
  const res = await axios.post(`${API_URL}/route/estimate`, params);
  return res.data;
};
