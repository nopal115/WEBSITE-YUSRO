import { LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/hooks/useAuth';
import { AppShell } from './AppShell';
import { ADMIN_NAV_ITEMS, adminPageTitle, isAdminNavItemActive } from './navigation';

function LogoutButton({ onLogout, pending, collapsed = false, iconOnly = false, labelClass = '' }: { onLogout: () => void; pending: boolean; collapsed?: boolean; iconOnly?: boolean; labelClass?: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={pending}
      aria-busy={pending || undefined}
      aria-label={iconOnly ? 'Keluar' : undefined}
      title={iconOnly ? 'Keluar' : undefined}
      className={`flex min-h-14 w-full items-center gap-4 rounded-md border border-transparent px-4 text-text-secondary transition hover:bg-neutral-surface-alt disabled:cursor-not-allowed disabled:text-text-muted ${collapsed ? 'md:justify-center md:px-0 lg:justify-start lg:px-4' : ''}`}
    >
      <LogOut size={24} className="shrink-0" aria-hidden="true" />
      <span className={`text-body ${labelClass}`}>Keluar</span>
    </button>
  );
}

// Tata letak Admin/Pengajar (SDD 7.5, sitemap 12.5): kerangka bersama tanpa bilah bawah; di bawah
// 768 px navigasi hanya lewat laci. Tombol logout ada di sidebar dan laci (SRS FR-AUTH-03).
// [REKOMENDASI] Tampilan disusun dari SDD dan UI kit; tidak ada desain Figma untuk admin.
export function AdminLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  const handleLogout = async (): Promise<void> => {
    setPending(true);
    await logout();
    navigate('/login', { replace: true });
  };
  const onLogout = () => void handleLogout();

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
