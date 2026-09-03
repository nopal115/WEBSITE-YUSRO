import { apiClient } from './api.client'

export const learningService = {
  listMaterials: () => apiClient.get('/learning/materials'),
  getMaterial: (id: string) => apiClient.get(`/learning/materials/${id}`),
  updateProgress: (id: string, progress: number) => apiClient.patch(`/learning/materials/${id}/progress`, { progress }),
}
