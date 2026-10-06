import api from './axios';

export const dashboardsApi = {
  list: () => api.get('/dashboards'),
  getById: (id: string) => api.get(`/dashboards/${id}`),
  getFull: (id: string, params?: any) => api.get(`/dashboards/${id}/full`, { params }),
  create: (data: any) => api.post('/dashboards', data),
  update: (id: string, data: any) => api.put(`/dashboards/${id}`, data),
  delete: (id: string) => api.delete(`/dashboards/${id}`),
  addWidget: (dashboardId: string, data: any) => api.post(`/dashboards/${dashboardId}/widgets`, data),
  updateWidget: (widgetId: string, data: any) => api.put(`/dashboards/widgets/${widgetId}`, data),
  deleteWidget: (widgetId: string) => api.delete(`/dashboards/widgets/${widgetId}`),
  getWidgetData: (widgetId: string, params?: any) => api.get(`/dashboards/widgets/${widgetId}/data`, { params }),
  getMyWorkspace: () => api.get('/dashboards/my/workspace'),
};