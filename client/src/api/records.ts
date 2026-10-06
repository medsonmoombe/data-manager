import api from './axios';

export const recordsApi = {
  list: (entityName: string, params?: any) => api.get(`/mdm/records/${entityName}`, { params }),
  getById: (entityName: string, id: string) => api.get(`/mdm/records/${entityName}/${id}`),
  search: (entityName: string, params: any) => api.get(`/mdm/search/${entityName}`, { params }),
  getProfile: (entityType: string, recordId: string) => api.get(`/intelligence/profile/${entityType}/${recordId}`),
  getTimeline: (entityType: string, recordId: string) => api.get(`/intelligence/timeline/${entityType}/${recordId}`),
  getRelationships: (entityType: string, recordId: string) => api.get(`/intelligence/relationships/${entityType}/${recordId}`),
  createRelationship: (data: any) => api.post('/intelligence/relationships', data),
  globalSearch: (query: string, entityType?: string) => api.get('/intelligence/search', { params: { query, entityType } }),
  advancedSearch: (data: any) => api.post('/search/advanced', data),
  exportData: (entityName: string, params?: any) => api.get(`/export/${entityName}`, { params, responseType: 'blob' }),
};