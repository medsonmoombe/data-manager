import api from './axios';

export const validationApi = {
  getSummary: () => api.get('/validation/summary'),
  getResults: (params?: any) => api.get('/validation/results', { params }),
  getRules: () => api.get('/validation/rules'),
  createRule: (data: any) => api.post('/validation/rules', data),
  updateRule: (id: string, data: any) => api.put(`/validation/rules/${id}`, data),
  deleteRule: (id: string) => api.delete(`/validation/rules/${id}`),
  fixResult: (id: string) => api.post(`/validation/results/${id}/fix`),
  ignoreResult: (id: string) => api.post(`/validation/results/${id}/ignore`),
  runBatch: (entityName: string) => api.post(`/validation/run/${entityName}`),
};