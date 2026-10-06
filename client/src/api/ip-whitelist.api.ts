import api from './axios';

export const ipWhitelistApi = {
  list: () => api.get('/settings/ip-whitelist'),
  create: (data: { ipAddress: string; cidr?: string; description?: string }) => api.post('/settings/ip-whitelist', data),
  delete: (id: string) => api.delete(`/settings/ip-whitelist/${id}`),
  toggle: (id: string, isActive: boolean) => api.put(`/settings/ip-whitelist/${id}/toggle`, { isActive }),
};