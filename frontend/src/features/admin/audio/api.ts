import { apiRequest } from '../../../lib/api/client';
import type { AdminAudioItem, AudioKind, AudioUrlResponse } from './types';

export const adminAudioApi = {
  list: (kind?: string, signal?: AbortSignal): Promise<AdminAudioItem[]> => {
    const query = kind && kind !== 'ALL' ? `?kind=${encodeURIComponent(kind)}` : '';
    return apiRequest<AdminAudioItem[]>(`admin/audio${query}`, { signal });
  },

  getUrl: (id: string): Promise<AudioUrlResponse> =>
    apiRequest<AudioUrlResponse>(`admin/audio/${encodeURIComponent(id)}/url`),

  upload: (file: File, kind: AudioKind): Promise<AdminAudioItem> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);
    formData.append('type', kind);
    return apiRequest<AdminAudioItem>('admin/audio', {
      method: 'POST',
      body: formData,
    });
  },

  archive: (id: string): Promise<unknown> =>
    apiRequest<unknown>(`admin/audio/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
    }),

  replace: (id: string, file: File): Promise<AdminAudioItem> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest<AdminAudioItem>(`admin/audio/${encodeURIComponent(id)}/replace`, {
      method: 'POST',
      body: formData,
    });
  },
};
