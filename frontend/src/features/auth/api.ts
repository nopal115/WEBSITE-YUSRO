import { ApiError } from '../../lib/api/ApiError';
import { apiRequest } from '../../lib/api/client';
import type { LoginInput, LoginResponse, User } from './types';

export const authApi = {
  login: (input: LoginInput): Promise<LoginResponse> =>
    apiRequest<LoginResponse>('auth/login', { method: 'POST', body: input, auth: false }),

  getMe: (signal?: AbortSignal): Promise<User> => apiRequest<User>('user/me', { signal }),
};

/** Pesan khusus endpoint login (SDD 7.7.2); status lain memakai pesan umum ApiError. */
export function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // Pesan kredensial dibuat seragam agar tidak membocorkan email mana yang terdaftar.
    // 400 ikut dipetakan karena LoginDto backend menolak password < 8 karakter dengan 400.
    if (error.status === 401 || error.status === 400) return 'Email atau password salah.';
    // [TBD] Backend belum mengembalikan 403 untuk akun INACTIVE (SDD 6.3.3, 7.7.2).
    if (error.status === 403) return 'Akun dinonaktifkan, hubungi pengajar.';
    return error.message;
  }
  return 'Terjadi kesalahan. Coba lagi.';
}
