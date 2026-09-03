import type { AudioPayload } from '../types'
import { apiClient } from './api.client'

export const imitationService = {
  submit: (taskId: string, audio: AudioPayload) => {
    const formData = new FormData()
    formData.append('audio', audio.blob, 'submission.wav')
    return apiClient.post(`/imitation/tasks/${taskId}/submissions`, formData)
  },
  getSubmission: (id: string) => apiClient.get(`/imitation/submissions/${id}`),
}
