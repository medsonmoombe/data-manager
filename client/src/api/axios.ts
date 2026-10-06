import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach token & orgId
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    const orgId = useAuthStore.getState().orgId;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (orgId) {
      config.headers['x-org-id'] = orgId;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle 401/403
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;