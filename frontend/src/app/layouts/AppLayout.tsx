import { LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/hooks/useAuth';
import { AppShell } from './AppShell';
import { BOTTOM_NAV_ITEMS, isNavItemActive, isPathActive, NAV_ITEMS, pageTitle } from './navigation';

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

// Tata letak Santri: kerangka bersama (AppShell) + bilah bawah mobile empat butir (SDD 7.5.2).
export function AppLayout(): JSX.Element {
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
      items={NAV_ITEMS}
      isActive={isNavItemActive}
      title={pageTitle(pathname)}
      headerEnd={
        <Link to="/profil" className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 text-body text-text-secondary hover:bg-neutral-surface-alt">
          <User size={24} aria-hidden="true" />
          <span className="max-w-40 truncate">{user?.name ?? 'Profil'}</span>
        </Link>
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
      bottomNav={
        // [REKOMENDASI] Bilah bawah memperhitungkan env(safe-area-inset-bottom).
        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-neutral-border bg-neutral-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:hidden"
          aria-label="Navigasi utama"
        >
          {BOTTOM_NAV_ITEMS.map((item) => {
            const active = item.activeFor.some((path) => isPathActive(pathname, path));
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 min-w-11 flex-col items-center justify-center gap-1 text-caption ${active ? 'text-brand-primary' : 'text-text-secondary'}`}
              >
                <item.icon size={24} aria-hidden="true" />
                <span className={active ? 'font-semibold' : ''}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      }
    />
  );
}
