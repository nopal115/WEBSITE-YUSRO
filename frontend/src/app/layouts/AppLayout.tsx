import { PanelLeftClose, PanelLeftOpen, User } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/hooks/useAuth';
import { BOTTOM_NAV_ITEMS, isPathActive, NAV_ITEMS, pageTitle } from './navigation';

const COLLAPSED_KEY = 'yusro.sidebarCollapsed';

/** Status lipat sidebar tablet; bawaan terlipat. Disimpan per perangkat. */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(value));
  } catch {
    // Abaikan: status tetap berlaku sampai halaman dimuat ulang.
  }
}

// SDD 7.5: mobile < 768 px bilah bawah; tablet 768–1023 px sidebar dapat dilipat;
// desktop ≥ 1024 px sidebar tetap 240 px.
export function AppLayout(): JSX.Element {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = (): void => {
    setCollapsed((value) => {
      writeCollapsed(!value);
      return !value;
    });
  };

  // Lipatan hanya berlaku di tablet; di desktop sidebar selalu terbuka.
  const labelClass = collapsed ? 'md:sr-only lg:not-sr-only' : '';

  return (
    <div className="flex min-h-screen bg-neutral-surface-alt text-text-primary">
      <aside
        id="sidebar"
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-neutral-border bg-neutral-surface px-4 pb-8 pt-[calc(2rem+env(safe-area-inset-top))] md:flex lg:w-60 ${collapsed ? 'md:w-20' : 'md:w-60'}`}
        aria-label="Navigasi utama"
      >
        <div className={`mb-12 flex items-center gap-3 ${collapsed ? 'md:justify-center lg:justify-start' : ''}`}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-brand-primary font-arabic text-arabic-s text-brand-accent" aria-hidden="true" lang="ar" dir="rtl">ي</div>
          <span className={`text-h2 text-brand-primary ${labelClass}`}>Yusro</span>
        </div>
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex min-h-14 items-center gap-4 rounded-md border px-4 transition ${collapsed ? 'md:justify-center md:px-0 lg:justify-start lg:px-4' : ''} ${isActive ? 'border-brand-primary-line bg-brand-primary-soft text-brand-primary' : 'border-transparent text-text-secondary hover:bg-neutral-surface-alt'}`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={24} className="shrink-0" aria-hidden="true" />
                  <span className={`${isActive ? 'text-h3' : 'text-body'} ${labelClass}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        {/* TODO: FR-AUTH-03 (logout) wajib menurut SRS; posisi tombol [TBD], menunggu desain. */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="sidebar"
          aria-label={collapsed ? 'Buka navigasi' : 'Lipat navigasi'}
          className="hidden h-11 w-11 items-center justify-center self-center rounded-md text-text-secondary hover:bg-neutral-surface-alt md:flex lg:hidden"
        >
          {collapsed ? <PanelLeftOpen size={24} aria-hidden="true" /> : <PanelLeftClose size={24} aria-hidden="true" />}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header menyisakan ruang poni/status bar (viewport-fit=cover). */}
        <header className="sticky top-0 z-20 border-b border-neutral-border bg-neutral-surface pt-[env(safe-area-inset-top)]">
          <div className="flex h-16 items-center gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:px-8 lg:px-12">
            <p className="min-w-0 flex-1 truncate text-h2">{pageTitle(pathname)}</p>
            <Link to="/profil" className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 text-body text-text-secondary hover:bg-neutral-surface-alt">
              <User size={24} aria-hidden="true" />
              <span className="max-w-40 truncate">{user?.name ?? 'Profil'}</span>
            </Link>
          </div>
        </header>

        {/* Mobile: ruang bawah = tinggi bilah bawah 64 px + 24 px + area aman (pengecualian skala jarak SDD 7.2.2: offset kompensasi elemen fixed). */}
        <main className="flex-1 pb-[calc(88px+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 md:p-8 lg:p-12">
          <Outlet />
        </main>
      </div>

      {/* [REKOMENDASI] Bilah bawah memperhitungkan env(safe-area-inset-bottom). */}
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
    </div>
  );
}
