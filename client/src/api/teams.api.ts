import api from './axios';

export const teamsApi = {
  list: () => api.get('/teams'),
  getById: (id: string) => api.get(`/teams/${id}`),
  create: (data: { name: string; description?: string }) => api.post('/teams', data),
  update: (id: string, data: any) => api.put(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
  addMembers: (id: string, userIds: string[], role: string) =>
    api.post(`/teams/${id}/members`, { userIds, role }),
  removeMember: (id: string, userId: string) =>
    api.delete(`/teams/${id}/members/${userId}`),
  updateMemberRole: (id: string, userId: string, role: string) =>
    api.put(`/teams/${id}/members/${userId}/role`, { role }),
};
