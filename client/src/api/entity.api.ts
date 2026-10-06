import api from './axios';

export const entitiesApi = {
  list: () => api.get('/entities'),
  getById: (id: string) => api.get(`/entities/${id}`),
  create: (data: any) => api.post('/entities', data),
  update: (id: string, data: any) => api.put(`/entities/${id}`, data),
  delete: (id: string) => api.delete(`/entities/${id}`),
  addAttribute: (entityId: string, data: any) => api.post(`/entities/${entityId}/attributes`, data),
  updateAttribute: (entityId: string, attrId: string, data: any) => api.put(`/entities/${entityId}/attributes/${attrId}`, data),
  deleteAttribute: (entityId: string, attrId: string) => api.delete(`/entities/${entityId}/attributes/${attrId}`),
  updateAttributes: (entityId: string, data: any[]) => api.put(`/entities/${entityId}/attributes`, data),
};