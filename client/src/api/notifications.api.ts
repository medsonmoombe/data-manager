import api from './axios';

export const notificationsApi = {
  list: (params?: any) => api.get('/notifications', { params }),
  getMyNotifications: (params?: any) => api.get('/notifications/my', { params }),
  send: (data: any) => api.post('/notifications/send', data),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  listTemplates: () => api.get('/notifications/templates'),
  createTemplate: (data: any) => api.post('/notifications/templates', data),
  listChannels: () => api.get('/notifications/channels'),
  createChannel: (data: any) => api.post('/notifications/channels', data),
  getPreferences: () => api.get('/notifications/preferences'),
  setPreference: (data: any) => api.post('/notifications/preferences', data),
};