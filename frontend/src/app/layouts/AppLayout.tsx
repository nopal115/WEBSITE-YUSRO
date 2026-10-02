import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../lib/hooks/useAuth';

const navigationItems = [
  { label: 'Beranda', to: '/dashboard' },
  { label: 'Pembelajaran', to: '/pembelajaran' },
  { label: 'Progress', to: '/progress' },
  { label: 'Riwayat', to: '/riwayat' },
  { label: 'Profil', to: '/profil' },
];

export function AppLayout(): JSX.Element {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-neutral-bg text-text-primary">
      <aside className="flex w-[248px] shrink-0 flex-col border-r border-neutral-border bg-white px-6 py-8" aria-label="Navigasi utama">
        <div className="mb-12 flex items-center gap-3 px-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-[6px] bg-brand-primary text-arabic-s text-brand-accent" aria-hidden="true">ي</div>
          <span className="text-h2 text-brand-primary">Yusro</span>
        </div>
        <nav className="flex flex-col gap-2">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) => `flex min-h-14 items-center gap-4 rounded-[10px] border px-4 transition ${isActive ? 'border-brand-primary-line bg-brand-primary-soft text-brand-primary' : 'border-transparent text-text-secondary hover:bg-neutral-surface-alt'}`}
            >
              {({ isActive }) => (
                <>
                  <span className={`h-7 w-7 rounded-[6px] ${isActive ? 'bg-brand-primary' : 'bg-text-muted'}`} aria-hidden="true" />
                  <span className={isActive ? 'text-h3' : 'text-body'}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        {/* [REKOMENDASI] Tidak ada di Figma; perlu agar santri bisa logout. Posisi final menunggu desain. */}
        <Button variant="ghost" className="w-full" onClick={logout}>KELUAR</Button>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
