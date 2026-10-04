import type { UserRole } from './types';

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

export function homePathForRole(role: UserRole): string {
  // TODO(admin): ganti setelah halaman Admin/Pengajar dibuat.
  return role === 'ADMIN' ? '/admin' : '/';
}

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/**
 * Tujuan setelah login: halaman yang tadi diminta bila aman dan sesuai role,
 * selain itu beranda role. Hanya path internal yang diterima (mencegah open redirect).
 */
export function resolvePostLoginPath(from: unknown, role: UserRole): string {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || from.includes('\\')) {
    return homePathForRole(role);
  }

  const pathname = from.split(/[?#]/)[0];
  if (AUTH_PATHS.includes(pathname)) return homePathForRole(role);
  if (isAdminPath(pathname) !== (role === 'ADMIN')) return homePathForRole(role);

  return from;
}
