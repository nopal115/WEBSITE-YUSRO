import axios from 'axios'
import { API_BASE_URL } from '../config'

export const apiClient = axios.create({ baseURL: API_BASE_URL })

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('yusro_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
