import api from './axios';

export const intelligenceApi = {
  getNarrativeReport: (period?: string) => api.get('/intelligence/reports/narrative', { params: { period } }),
  getSuggestions: (params?: any) => api.get('/intelligence/suggestions', { params }),
  acceptSuggestion: (id: string) => api.post(`/intelligence/suggestions/${id}/accept`),
  rejectSuggestion: (id: string) => api.post(`/intelligence/suggestions/${id}/reject`),
  dismissSuggestion: (id: string) => api.post(`/intelligence/suggestions/${id}/dismiss`),
  getDuplicatesSummary: () => api.get('/intelligence/duplicates/summary'),
  getDuplicates: (params?: any) => api.get('/intelligence/duplicates', { params }),
  mergeDuplicates: (id: string) => api.post(`/intelligence/duplicates/${id}/merge`),
  scanDuplicates: () => api.post('/intelligence/duplicates/scan'),
  getLineage: (entityType: string, recordId: string) => api.get(`/intelligence/lineage/${entityType}/${recordId}`),
  getAutoLinkRules: () => api.get('/intelligence/auto-link-rules'),
  createAutoLinkRule: (data: any) => api.post('/intelligence/auto-link-rules', data),
  runAutoLink: () => api.post('/intelligence/auto-link/run'),
};