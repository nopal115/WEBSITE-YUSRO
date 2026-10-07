import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { NavItem } from './navigation';

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Tombol pembuka; fokus dikembalikan ke sini saat laci ditutup. */
  returnFocusRef: RefObject<HTMLElement>;
  items: NavItem[];
  isActive: (pathname: string, item: NavItem) => boolean;
  /** Isi bawah laci (mis. tombol logout admin). */
  footer?: ReactNode;
}

/**
 * Laci navigasi mobile (SDD 7.5.1). <dialog> + showModal() memberi role dialog, modal,
 * penutupan dengan Esc, dan membuat bagian halaman lain inert sehingga fokus terkunci di laci.
 */
export function NavDrawer({ open, onClose, returnFocusRef, items, isActive, footer }: NavDrawerProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Event close muncul untuk Esc, klik di luar, tombol tutup, maupun memilih tujuan.
    const handleClose = (): void => {
      onClose();
      returnFocusRef.current?.focus();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose, returnFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      id="nav-drawer"
      aria-label="Menu navigasi"
      aria-modal="true"
      // Klik pada backdrop mengenai elemen dialog itu sendiri, bukan isinya.
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 bg-neutral-surface p-0 text-text-primary backdrop:bg-text-primary/40 open:animate-[drawer-in_200ms_ease-out] motion-reduce:open:animate-none"
    >
      <div className="flex h-full flex-col pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-brand-primary font-arabic text-arabic-s text-brand-accent" aria-hidden="true" lang="ar" dir="rtl">ي</div>
            <span className="text-h2 text-brand-primary">Yusro</span>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Tutup menu"
            className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-surface-alt"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        <nav className="flex flex-col gap-2" aria-label="Navigasi utama">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive(pathname, item) ? 'page' : undefined}
              // Laci tertutup setelah memilih tujuan.
              onClick={() => dialogRef.current?.close()}
              className={`flex min-h-14 items-center gap-4 rounded-md border px-4 ${isActive(pathname, item) ? 'border-brand-primary-line bg-brand-primary-soft text-brand-primary' : 'border-transparent text-text-secondary hover:bg-neutral-surface-alt'}`}
            >
              <item.icon size={24} className="shrink-0" aria-hidden="true" />
              <span className="text-body">{item.label}</span>
            </Link>
          ))}
        </nav>
        {footer}
      </div>
    </dialog>
  );
}
