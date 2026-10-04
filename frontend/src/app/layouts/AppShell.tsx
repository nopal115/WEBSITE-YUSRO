import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import type { NavItem } from './navigation';
import { NavDrawer } from './NavDrawer';

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

// Keadaan aktif dihitung sendiri (bukan NavLink) karena satu butir bisa aktif untuk beberapa path.
function SidebarLink({ item, active, collapsed, labelClass }: { item: NavItem; active: boolean; collapsed: boolean; labelClass: string }): JSX.Element {
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`flex min-h-14 items-center gap-4 rounded-md border px-4 transition ${collapsed ? 'md:justify-center md:px-0 lg:justify-start lg:px-4' : ''} ${active ? 'border-brand-primary-line bg-brand-primary-soft text-brand-primary' : 'border-transparent text-text-secondary hover:bg-neutral-surface-alt'}`}
    >
      <item.icon size={24} className="shrink-0" aria-hidden="true" />
      <span className={`${active ? 'text-h3' : 'text-body'} ${labelClass}`}>{item.label}</span>
    </Link>
  );
}

/** Konteks isi bawah sidebar; labelClass menyembunyikan label saat terlipat di tablet. */
export interface SidebarFooterContext {
  collapsed: boolean;
  labelClass: string;
}

interface AppShellProps {
  items: NavItem[];
  isActive: (pathname: string, item: NavItem) => boolean;
  title: string;
  /** Isi kanan header (mis. tautan profil santri, nama admin). */
  headerEnd: ReactNode;
  /** Isi bawah sidebar di atas tombol lipat (mis. tombol logout admin). */
  sidebarFooter?: (context: SidebarFooterContext) => ReactNode;
  /** Isi bawah laci mobile. */
  drawerFooter?: ReactNode;
  /** Bilah bawah mobile; bila tidak ada, ruang bawah <main> kembali normal. */
  bottomNav?: ReactNode;
}

/**
 * Kerangka bersama santri dan admin (SDD 7.5): mobile < 768 px laci (+ bilah bawah bila ada);
 * tablet 768–1023 px sidebar dapat dilipat; desktop ≥ 1024 px sidebar tetap 240 px.
 */
export function AppShell({ items, isActive, title, headerEnd, sidebarFooter, drawerFooter, bottomNav }: AppShellProps): JSX.Element {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

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
          {items.map((item) => (
            <SidebarLink key={item.to} item={item} active={isActive(pathname, item)} collapsed={collapsed} labelClass={labelClass} />
          ))}
        </nav>
        <div className="flex-1" />
        {sidebarFooter?.({ collapsed, labelClass })}
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
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Buka menu"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              aria-controls="nav-drawer"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-surface-alt md:hidden"
            >
              <Menu size={24} aria-hidden="true" />
            </button>
            <p className="min-w-0 flex-1 truncate text-h2">{title}</p>
            {headerEnd}
          </div>
        </header>

        {/* Dengan bilah bawah: ruang bawah = tinggi bilah 64 px + 24 px + area aman (pengecualian skala jarak SDD 7.2.2: offset kompensasi elemen fixed). */}
        <main
          className={`flex-1 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 md:p-8 lg:p-12 ${bottomNav ? 'pb-[calc(88px+env(safe-area-inset-bottom))]' : 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]'}`}
        >
          <Outlet />
        </main>
      </div>

      <NavDrawer open={drawerOpen} onClose={closeDrawer} returnFocusRef={menuButtonRef} items={items} isActive={isActive} footer={drawerFooter} />

      {bottomNav}
    </div>
  );
}
