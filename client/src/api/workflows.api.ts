import api from './axios';

export const workflowsApi = {
  listDefinitions: () => api.get('/workflows/definitions'),
  getDefinition: (id: string) => api.get(`/workflows/definitions/${id}`),
  createDefinition: (data: any) => api.post('/workflows/definitions', data),
  updateDefinition: (id: string, data: any) => api.put(`/workflows/definitions/${id}`, data),
  deleteDefinition: (id: string) => api.delete(`/workflows/definitions/${id}`),
  startWorkflow: (id: string, data?: any) => api.post(`/workflows/definitions/${id}/start`, data),
  listInstances: (params?: any) => api.get('/workflows/instances', { params }),
  getMyTasks: () => api.get('/workflows/tasks/my'),
  listTasks: (params?: any) => api.get('/workflows/tasks', { params }),
  approveTask: (id: string, comment?: string) => api.post(`/workflows/tasks/${id}/approve`, { comment }),
  rejectTask: (id: string, comment?: string) => api.post(`/workflows/tasks/${id}/reject`, { comment }),
  listRoles: () => api.get('/roles'),
  bulkApprove: (taskIds: string[], comment?: string) => api.post('/workflows/tasks/bulk-approve', { taskIds, comment }),
};