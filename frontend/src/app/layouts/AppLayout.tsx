import { LogOut, Menu } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/ui/Avatar';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { useProfile } from '../../features/profile/hooks';
import { useAuth } from '../../lib/hooks/useAuth';
import { isNavItemActive, NAV_ITEMS, pageTitle } from './navigation';
import { NavDrawer } from './NavDrawer';

const iconButton = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-surface-alt';

/**
 * Tata letak Santri: satu navbar atas (logo, menu, avatar, Keluar) dan konten selebar layar.
 * [TBD] Revisi desain pembimbing: menggantikan sidebar kiri dan bilah bawah mobile SDD 7.5; SDD 7.5 perlu direvisi.
 * Di bawah 1024 px enam butir menu tidak muat, jadi menu dan Keluar dilipat ke laci (NavDrawer).
 */
export function AppLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Foto profil diambil dari cache profil yang sama dengan halaman Profil, jadi perubahan langsung tampil di sini.
  const profile = useProfile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const title = pageTitle(pathname);

  const openLogout = (fromDrawer: boolean) => {
    if (fromDrawer) setDrawerOpen(false);
    setConfirmLogout(true);
  };
  const closeLogout = useCallback(() => {
    setConfirmLogout(false);
    // Fokus kembali ke tombol yang terlihat: Keluar di navbar (desktop) atau tombol menu (mobile).
    const desktopButton = logoutButtonRef.current;
    if (desktopButton && desktopButton.offsetParent !== null) desktopButton.focus();
    else menuButtonRef.current?.focus();
  }, []);
  // logout() dari useAuth tetap menghapus token dan cache walaupun request ke backend gagal (FR-AUTH-03).
  const confirm = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-neutral-surface-alt text-text-primary">
      <header className="sticky top-0 z-20 border-b border-neutral-border bg-neutral-surface pt-[env(safe-area-inset-top)]">
        <div className="flex h-16 items-center gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:px-8 lg:gap-6 lg:px-12">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka menu"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            aria-controls="nav-drawer"
            className={`${iconButton} lg:hidden`}
          >
            <Menu size={24} aria-hidden="true" />
          </button>
          <Link to="/" className="flex min-h-11 shrink-0 items-center gap-3 rounded-md" aria-label="Yusro, ke Beranda">
            <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-primary font-arabic text-arabic-s text-brand-accent" aria-hidden="true" lang="ar" dir="rtl">
              ي
            </span>
            <span className="text-h2 text-brand-primary" aria-hidden="true">
              Yusro
            </span>
          </Link>
          <nav className="hidden min-w-0 flex-1 justify-center lg:flex" aria-label="Navigasi utama">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isNavItemActive(pathname, item);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center whitespace-nowrap rounded-md border px-3 text-body transition ${active ? 'border-brand-primary-line bg-brand-primary-soft font-semibold text-brand-primary' : 'border-transparent text-text-secondary hover:bg-neutral-surface-alt'}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            <ThemeToggle />
            <Link to="/profil" className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 text-body text-text-secondary hover:bg-neutral-surface-alt" aria-label={`Profil ${user?.name ?? ''}`.trim()}>
              <Avatar name={user?.name ?? ''} src={profile.data?.avatarUrl} />
              <span className="hidden max-w-40 truncate xl:inline">{user?.name ?? 'Profil'}</span>
            </Link>
            <button
              ref={logoutButtonRef}
              type="button"
              onClick={() => openLogout(false)}
              className="hidden min-h-11 items-center gap-2 rounded-md px-3 text-body text-text-secondary hover:bg-neutral-surface-alt lg:flex"
            >
              <LogOut size={20} aria-hidden="true" />
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="w-full flex-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 md:p-8 lg:p-12">
        {/* Judul halaman yang dulu ada di header; tetap tampil untuk halaman di luar menu (mis. Materi, Statistik). */}
        {title && <p className="mb-6 text-h2">{title}</p>}
        <Outlet />
      </main>

      <NavDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        returnFocusRef={menuButtonRef}
        items={NAV_ITEMS}
        isActive={isNavItemActive}
        footer={
          <div className="mt-auto border-t border-neutral-border pt-4">
            <button
              type="button"
              onClick={() => openLogout(true)}
              className="flex min-h-14 w-full items-center gap-4 rounded-md border border-transparent px-4 text-text-secondary hover:bg-neutral-surface-alt"
            >
              <LogOut size={24} className="shrink-0" aria-hidden="true" />
              <span className="text-body">Keluar</span>
            </button>
          </div>
        }
      />

      {confirmLogout && (
        <ConfirmDialog
          title="Keluar dari akun?"
          message="Anda perlu masuk kembali untuk melanjutkan belajar."
          confirmLabel="KELUAR"
          confirmVariant="primary"
          pending={loggingOut}
          onConfirm={() => void confirm()}
          onClose={closeLogout}
        />
      )}
    </div>
  );
}
