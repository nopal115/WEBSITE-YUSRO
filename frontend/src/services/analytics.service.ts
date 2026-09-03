import { apiClient } from './api.client'

export const analyticsService = {
  studentReport: () => apiClient.get('/analytics/student-report'),
  teacherRecap: () => apiClient.get('/analytics/teacher-recap'),
  exportReport: (format: 'pdf' | 'csv') => apiClient.get(`/analytics/export?format=${format}`, { responseType: 'blob' }),
}
