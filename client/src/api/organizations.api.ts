import api from './axios';

export const organizationsApi = {
  list: () => api.get('/organizations'),
};
