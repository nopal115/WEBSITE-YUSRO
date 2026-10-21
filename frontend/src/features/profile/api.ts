import { apiRequest } from '../../lib/api/client';
import type { AvatarUploadResult, ChangePasswordInput, Profile, UpdateProfileInput } from './types';

// SDD 5.7.
export const profileApi = {
  get: (signal?: AbortSignal): Promise<Profile> => apiRequest<Profile>('profile', { signal }),

  /** PROPOSED API CONTRACT - sinkronkan dengan backend: body { name, phone }, respons profil terbaru. */
  update: (input: UpdateProfileInput): Promise<Profile> => apiRequest<Profile>('profile', { method: 'PATCH', body: input }),

  changePassword: (input: ChangePasswordInput): Promise<void> =>
    apiRequest<void>('profile/password', { method: 'PATCH', body: input }),

  /** PROPOSED API CONTRACT - sinkronkan dengan backend: multipart field "file" → { avatarUrl }. */
  uploadAvatar: (file: File): Promise<AvatarUploadResult> => {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<AvatarUploadResult>('profile/avatar', { method: 'POST', body: form });
  },

  /** PROPOSED API CONTRACT - sinkronkan dengan backend: 204 tanpa isi. */
  deleteAvatar: (): Promise<void> => apiRequest<void>('profile/avatar', { method: 'DELETE' }),
};
