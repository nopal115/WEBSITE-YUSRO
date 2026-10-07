import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { authApi } from '../../features/auth/api';
import type { User, UserRole } from '../../features/auth/types';
import { ApiError } from '../api/ApiError';
import { tokenStore } from '../auth/tokenStore';

export const AUTH_ME_QUERY_KEY = ['auth', 'me'] as const;

function useAccessToken(): string | null {
  return useSyncExternalStore(tokenStore.subscribe, tokenStore.get);
}

export interface AuthState {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  /** true selama token ada tetapi data user belum diketahui. */
  isLoading: boolean;
  /** Gagal memuat user karena alasan selain 401 (mis. jaringan atau server). */
  error: ApiError | null;
  retry: () => void;
  /** Memanggil POST /auth/logout; token dan cache tetap dihapus walaupun request gagal. */
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: ({ signal }) => authApi.getMe(signal),
    enabled: token !== null,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // SDD 5.6 / FR-AUTH-03.
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Sesi lokal tetap diakhiri walaupun server gagal dihubungi.
    } finally {
      tokenStore.clear();
      queryClient.clear();
    }
  }, [queryClient]);

  const { refetch } = meQuery;
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const user = token !== null ? (meQuery.data ?? null) : null;
  const error = token !== null && meQuery.error instanceof ApiError ? meQuery.error : null;

  return {
    user,
    role: user?.role ?? null,
    isAuthenticated: user !== null,
    isLoading: token !== null && meQuery.isPending && !meQuery.isError,
    error,
    retry,
    logout,
  };
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ accessToken }) => {
      // Buang cache sesi sebelumnya. Data user lengkap (termasuk email) diambil dari /auth/me,
      // karena ringkasan pada respons login tidak memuat email (SDD 5.6).
      queryClient.clear();
      tokenStore.set(accessToken);
    },
  });
}
