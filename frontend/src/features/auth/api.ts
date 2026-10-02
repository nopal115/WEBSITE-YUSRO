import { ApiError } from '../../lib/api/ApiError';
import { apiRequest } from '../../lib/api/client';
import type { ForgotPasswordInput, LoginInput, LoginResponse, RegisterInput, ResetPasswordInput, User } from './types';

// SDD 5.6.
export const authApi = {
  register: (input: RegisterInput): Promise<User> =>
    apiRequest<User>('auth/register', { method: 'POST', body: input, auth: false }),

  login: (input: LoginInput): Promise<LoginResponse> =>
    apiRequest<LoginResponse>('auth/login', { method: 'POST', body: input, auth: false }),

  logout: (): Promise<void> => apiRequest<void>('auth/logout', { method: 'POST' }),

  forgotPassword: (input: ForgotPasswordInput): Promise<void> =>
    apiRequest<void>('auth/forgot-password', { method: 'POST', body: input, auth: false }),

  resetPassword: (input: ResetPasswordInput): Promise<void> =>
    apiRequest<void>('auth/reset-password', { method: 'POST', body: input, auth: false }),

  getMe: (signal?: AbortSignal): Promise<User> => apiRequest<User>('auth/me', { signal }),
};

/** Pesan khusus endpoint login (SDD 3.2.7); status lain memakai pesan umum ApiError. */
export function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // Pesan kredensial dibuat seragam agar tidak membocorkan email mana yang terdaftar.
    // Status 400/401/403 tetap dipetakan untuk backend yang belum mengirim errorCode.
    if (error.code === 'AUTH_INVALID_CREDENTIALS' || (!error.code && (error.status === 401 || error.status === 400))) {
      return 'Email atau password salah.';
    }
    if (error.code === 'AUTH_ACCOUNT_INACTIVE' || (!error.code && error.status === 403)) {
      return 'Akun Anda dinonaktifkan. Hubungi pengajar.';
    }
    return error.message;
  }
  return 'Terjadi kesalahan. Coba lagi.';
}
