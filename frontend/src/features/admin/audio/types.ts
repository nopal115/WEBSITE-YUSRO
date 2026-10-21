export type AudioKind = 'LEARNING' | 'REFERENCE' | 'RECORDING';
export type AudioStatus = 'ACTIVE' | 'ARCHIVED';

export interface AdminAudioItem {
  id: string;
  kind: AudioKind;
  originalName: string;
  durationMs: number;
  durationSeconds?: number;
  status: AudioStatus;
  sizeBytes?: number;
  createdAt?: string;
}

export interface AudioUrlResponse {
  url: string;
  expiresInSeconds: number;
}
