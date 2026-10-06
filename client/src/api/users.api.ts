import api from './axios';

export const usersApi = {
  list: () => api.get('/users'),
  getById: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  deactivate: (id: string) => api.post(`/users/${id}/deactivate`),
  assignRole: (userId: string, roleId: string) => api.post(`/users/${userId}/roles/${roleId}`),
  removeRole: (userId: string, roleId: string) => api.delete(`/users/${userId}/roles/${roleId}`),
  getRoles: () => api.get('/roles'),
  createRole: (data: any) => api.post('/roles', data),
  updateRole: (id: string, data: any) => api.put(`/roles/${id}`, data),
  deleteRole: (id: string) => api.delete(`/roles/${id}`),
  getAvailablePermissions: () => api.get('/roles/permissions/list'),
};