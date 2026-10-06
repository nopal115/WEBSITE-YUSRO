import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../lib/api/ApiError';
import { setUnauthorizedHandler } from '../lib/api/client';
import { router } from './router';

const MAX_QUERY_RETRIES = 2;

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Error 4xx tidak akan berubah bila diulang; hanya jaringan/5xx yang dicoba lagi.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < MAX_QUERY_RETRIES;
        },
      },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  const [queryClient] = useState(createQueryClient);

  useEffect(
    () =>
      setUnauthorizedHandler((end) => {
        queryClient.clear();
        const { pathname, search, hash } = window.location;
        if (end.reason === 'inactive') {
          // Akun dinonaktifkan: pesan server ditampilkan di halaman login, tanpa kembali ke halaman semula.
          void router.navigate('/login', { replace: true, state: { notice: end.message, noticeTone: 'warning' } });
          return;
        }
        if (pathname === '/login') return;
        void router.navigate('/login', { replace: true, state: { from: `${pathname}${search}${hash}` } });
      }),
    [queryClient],
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
