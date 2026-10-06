import api from './axios';

export const formsApi = {
  list: () => api.get('/forms'),
  getById: (id: string) => api.get(`/forms/${id}`),
  create: (data: any) => api.post('/forms', data),
  update: (id: string, data: any) => api.put(`/forms/${id}`, data),
  delete: (id: string) => api.delete(`/forms/${id}`),
  publish: (id: string) => api.post(`/forms/${id}/publish`),
  retire: (id: string) => api.post(`/forms/${id}/retire`),
  submit: (id: string, data: any) => api.post(`/forms/${id}/submit`, data),
  getSubmissions: (id: string, params?: any) => api.get(`/forms/${id}/submissions`, { params }),
  getFieldStats: (id: string, fieldName: string) => api.get(`/forms/${id}/stats/${fieldName}`),
};