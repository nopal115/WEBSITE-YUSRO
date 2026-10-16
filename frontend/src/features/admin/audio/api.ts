import { apiRequest } from '../../../lib/api/client';
import type { RecordingUrl } from '../monitoring/types';
import type { AdminAudio, AdminAudioDetail, AudioFilter, AudioKind } from './types';

const audio = (id: string) => `admin/audio/${encodeURIComponent(id)}`;

function fileForm(file: File, kind?: AudioKind): FormData {
  const form = new FormData();
  form.append('file', file);
  if (kind) form.append('kind', kind);
  return form;
}

// SDD 5.16.
export const adminAudioApi = {
  list: (filter: AudioFilter, signal?: AbortSignal): Promise<AdminAudio[]> => {
    const params = new URLSearchParams();
    if (filter.kind) params.set('kind', filter.kind);
    if (filter.status) params.set('status', filter.status);
    const query = params.toString();
    return apiRequest<AdminAudio[]>(query ? `admin/audio?${query}` : 'admin/audio', { signal });
  },
  get: (id: string, signal?: AbortSignal): Promise<AdminAudioDetail> => apiRequest<AdminAudioDetail>(audio(id), { signal }),
  /** Multipart `file` + `kind`. */
  upload: (file: File, kind: AudioKind): Promise<AdminAudio> => apiRequest<AdminAudio>('admin/audio', { method: 'POST', body: fileForm(file, kind) }),
  /** Mengunggah versi baru sekaligus mengarsipkan yang lama (SDD 3.6.4). */
  replace: (id: string, file: File): Promise<AdminAudio> => apiRequest<AdminAudio>(`${audio(id)}/replace`, { method: 'POST', body: fileForm(file) }),
  archive: (id: string): Promise<AdminAudio> => apiRequest<AdminAudio>(`${audio(id)}/archive`, { method: 'POST' }),
  /** Diminta saat pratinjau diputar; hasilnya tidak disimpan di cache (NFR-PRIV-02). */
  getUrl: (id: string): Promise<RecordingUrl> => apiRequest<RecordingUrl>(`${audio(id)}/url`),
};
