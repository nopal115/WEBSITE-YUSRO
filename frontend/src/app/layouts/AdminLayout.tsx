import { User } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/hooks/useAuth';
import { AppShell } from './AppShell';
import { LogoutButton } from './LogoutButton';
import { useLogout } from './useLogout';
import { ADMIN_NAV_ITEMS, adminPageTitle, isAdminNavItemActive } from './navigation';

// Tata letak Admin/Pengajar (SDD 7.5, sitemap 12.5): kerangka bersama tanpa bilah bawah; di bawah
// 768 px navigasi hanya lewat laci. Tombol logout ada di sidebar dan laci (SRS FR-AUTH-03).
// [REKOMENDASI] Tampilan disusun dari SDD dan UI kit; tidak ada desain Figma untuk admin.
export function AdminLayout(): JSX.Element {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { onLogout, pending } = useLogout();

  return (
    <AppShell
      items={ADMIN_NAV_ITEMS}
      isActive={isAdminNavItemActive}
      title={adminPageTitle(pathname)}
      headerEnd={
        // Admin tidak punya halaman profil: nama ditampilkan sebagai teks.
        <span className="flex min-h-11 items-center gap-2 px-2 text-body text-text-secondary">
          <User size={24} aria-hidden="true" />
          <span className="max-w-40 truncate">{user?.name ?? 'Admin'}</span>
        </span>
      }
      sidebarFooter={({ collapsed, iconOnly, labelClass }) => (
        <div className="mb-4">
          <LogoutButton onLogout={onLogout} pending={pending} collapsed={collapsed} iconOnly={iconOnly} labelClass={labelClass} />
        </div>
      )}
      drawerFooter={
        <div className="mt-auto border-t border-neutral-border pt-4">
          <LogoutButton onLogout={onLogout} pending={pending} />
        </div>
      }
    />
  );
}
