import { apiRequest } from '../../lib/api/client';
import type { ChangePasswordInput, Profile, UpdateProfileInput } from './types';

// SDD 5.7.
export const profileApi = {
  get: (signal?: AbortSignal): Promise<Profile> => apiRequest<Profile>('profile', { signal }),

  /** [ASUMSI] Respons PATCH berisi profil terbaru; SDD tidak merinci. */
  update: (input: UpdateProfileInput): Promise<Profile> => apiRequest<Profile>('profile', { method: 'PATCH', body: input }),

  changePassword: (input: ChangePasswordInput): Promise<void> =>
    apiRequest<void>('profile/password', { method: 'PATCH', body: input }),
};
