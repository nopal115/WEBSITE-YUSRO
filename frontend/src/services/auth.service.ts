import { apiClient } from './api.client'

export const authService = {
  login: (payload: { email: string; password: string }) => apiClient.post('/auth/login', payload),
  register: (payload: unknown) => apiClient.post('/auth/register', payload),
  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),
}
