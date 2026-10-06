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

/**
 * Single-flight refresh: if several requests 401 at once we only want one
 * refresh call, and the rest should wait for its result.
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, logout } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    // Bare axios call so this cannot recurse back through the interceptor.
    const res = await axios.post(
      `${import.meta.env.VITE_API_URL}/auth/api/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    );

    // Backend wraps responses in { success, data, ... }.
    const payload = res.data?.data;
    if (!payload?.accessToken || !payload?.refreshToken) {
      logout();
      return null;
    }

    setTokens(payload.accessToken, payload.refreshToken);
    return payload.accessToken;
  } catch {
    logout();
    return null;
  }
}

// Response interceptor — unwrap the API envelope and recover from expired tokens
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = error.response?.status;
    const original = error.config;

    // Skip auth endpoints: a 401 from login/refresh means "bad credentials",
    // not "expired access token".
    const isAuthEndpoint =
      typeof original?.url === 'string' && original.url.includes('/auth/api/');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const token = await refreshPromise;
      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api(original);
      }

      useAuthStore.getState().logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

export default api;
