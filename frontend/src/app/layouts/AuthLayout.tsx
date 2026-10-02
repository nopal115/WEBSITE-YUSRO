import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { resolvePostLoginPath } from '../../features/auth/redirect';
import { useAuth } from '../../lib/hooks/useAuth';
import { AuthStatusScreen } from './AuthStatusScreen';

/**
 * Pembungkus halaman publik (login, registrasi, lupa password).
 * Pengguna yang sudah login, termasuk tepat setelah login berhasil, diarahkan
 * ke halaman yang tadi diminta atau ke beranda sesuai role.
 */
export function AuthLayout(): JSX.Element {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthStatusScreen />;

  if (isAuthenticated && role) {
    const from = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={resolvePostLoginPath(from, role)} replace />;
  }

  return <Outlet />;
}
