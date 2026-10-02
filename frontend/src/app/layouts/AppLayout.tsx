import { NavLink, Outlet } from 'react-router-dom';
import { NAV_ITEMS } from './navigation';

export function AppLayout(): JSX.Element {
  return (
    <div className="flex min-h-screen bg-neutral-bg text-text-primary">
      <aside className="flex w-[248px] shrink-0 flex-col border-r border-neutral-border bg-neutral-surface px-6 py-8" aria-label="Navigasi utama">
        <div className="mb-12 flex items-center gap-3 px-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-brand-primary font-arabic text-arabic-s text-brand-accent" aria-hidden="true" lang="ar" dir="rtl">ي</div>
          <span className="text-h2 text-brand-primary">Yusro</span>
        </div>
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) => `flex min-h-14 items-center gap-4 rounded-md border px-4 transition ${isActive ? 'border-brand-primary-line bg-brand-primary-soft text-brand-primary' : 'border-transparent text-text-secondary hover:bg-neutral-surface-alt'}`}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={24} aria-hidden="true" />
                  <span className={isActive ? 'text-h3' : 'text-body'}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        {/* TODO: FR-AUTH-03 (logout) wajib menurut SRS; posisi tombol [TBD], menunggu desain. */}
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
