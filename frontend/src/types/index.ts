export type UserRole = 'santri' | 'pengajar' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface Material {
  id: string
  title: string
  jilid: number
  order: number
  isLocked: boolean
  progress: number
}

export interface Submission {
  id: string
  materialId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  audioUrl?: string
  createdAt: string
}

export interface AudioPayload {
  blob: Blob
  sampleRate: 16000
  channels: 1
  format: 'wav'
}

export interface MLScoreResult {
  overallScore: number
  feedback: string
  verseScores: Array<{ verseId: string; score: number; feedback: string }>
  phonemeScores?: Array<{ phoneme: string; score: number }>
}
