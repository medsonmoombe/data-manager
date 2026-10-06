import api from './axios';

export const marketplaceApi = {
  listTemplates: (params?: any) => api.get('/marketplace/templates', { params }),
  getTemplate: (id: string) => api.get(`/marketplace/templates/${id}`),
  installTemplate: (id: string) => api.post(`/marketplace/templates/${id}/install`),
  customizeTemplate: (id: string, data: any) => api.post(`/marketplace/templates/${id}/customize`, data),
  getInstalled: () => api.get('/marketplace/installed'),
  uninstall: (id: string) => api.post(`/marketplace/templates/${id}/uninstall`),
  getCategories: () => api.get('/marketplace/categories'),
};