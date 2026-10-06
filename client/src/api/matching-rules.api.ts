import api from './axios';

export const matchingRulesApi = {
  list: () => api.get('/matching-rules'),
  getEntities: () => api.get('/matching-rules/entities'),
  create: (data: any) => api.post('/matching-rules', data),
  update: (id: string, data: any) => api.put(`/matching-rules/${id}`, data),
  delete: (id: string) => api.delete(`/matching-rules/${id}`),
  test: (id: string, data: { sourceData: any; targetData: any }) => api.post(`/matching-rules/${id}/test`, data),
};