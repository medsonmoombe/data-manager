import api from './axios';

export const invitationsApi = {
  create: (data: { email: string; teamIds: string[]; role: string }) =>
    api.post('/invitations', data),
  list: () => api.get('/invitations'),
  revoke: (id: string) => api.delete(`/invitations/${id}`),
  resend: (id: string) => api.post(`/invitations/${id}/resend`),
};
