import axios from 'axios';
import { API_URL } from '../utils/constants';
import { session } from '../storage/session';

const api = axios.create({
  baseURL: API_URL,
  timeout: 25000,
});

api.interceptors.request.use(async config => {
  const token = await session.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    if (error?.response?.status === 401) {
      await session.clear();
    }
    return Promise.reject(error);
  },
);

export default api;
