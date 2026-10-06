import api from './axios';

export const anomaliesApi = {
  list: (params?: any) => api.get('/anomalies', { params }),
  getSummary: () => api.get('/anomalies/summary'),
  triggerScan: () => api.post('/anomalies/scan'),
};