import api from './axios';

export const connectorsApi = {
  list: () => api.get('/connectors'),
  getById: (id: string) => api.get(`/connectors/${id}`),
  create: (data: any) => api.post('/connectors', data),
  delete: (id: string) => api.delete(`/connectors/${id}`),
  getJobs: (connectorId: string) => api.get(`/connectors/${connectorId}/jobs`),
  createJob: (connectorId: string, data: any) => api.post(`/connectors/${connectorId}/jobs`, data),
  runJob: (jobId: string) => api.post(`/connectors/jobs/${jobId}/run`),
  getRuns: (jobId: string) => api.get(`/connectors/jobs/${jobId}/runs`),
  getRunItems: (runId: string) => api.get(`/connectors/runs/${runId}/items`),
  getSupportedTypes: () => api.get('/connectors/meta/supported-types'),
};