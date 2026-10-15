import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { homePathForRole } from '../../features/auth/redirect';
import type { UserRole } from '../../features/auth/types';
import { useAuth } from '../../lib/hooks/useAuth';
import { AuthStatusScreen } from './AuthStatusScreen';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps): JSX.Element {
  const { isAuthenticated, isLoading, role, error, retry } = useAuth();
  const location = useLocation();

  // Jangan redirect sebelum status login diketahui.
  if (isLoading) return <AuthStatusScreen />;
  if (error) return <AuthStatusScreen error={error} onRetry={retry} />;

  if (!isAuthenticated || !role) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  return <Outlet />;
}
