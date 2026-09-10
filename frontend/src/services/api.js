import axios from 'axios';

// Fastapi default runs on port 8000
const API_URL = 'http://localhost:8000/api';

export const fetchHealth = async () => {
  const res = await axios.get(`${API_URL}/health`);
  return res.data;
};

export const fetchSummary = async () => {
  const res = await axios.get(`${API_URL}/analytics/summary`);
  return res.data;
};

export const fetchTrajectories = async () => {
  const res = await axios.get(`${API_URL}/trajectories`);
  return res.data;
};

export const fetchVehiclesOverTime = async () => {
  const res = await axios.get(`${API_URL}/analytics/vehicles-over-time`);
  return res.data;
};
