import { User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/hooks/useAuth';
import { AppShell } from './AppShell';
import { BOTTOM_NAV_ITEMS, isNavItemActive, isPathActive, NAV_ITEMS, pageTitle } from './navigation';

// Tata letak Santri: kerangka bersama (AppShell) + bilah bawah mobile empat butir (SDD 7.5.2).
export function AppLayout(): JSX.Element {
  const { user } = useAuth();
  const { pathname } = useLocation();

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
      // TODO: FR-AUTH-03 (logout) wajib menurut SRS; posisi tombol di sisi santri [TBD], menunggu desain.
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
