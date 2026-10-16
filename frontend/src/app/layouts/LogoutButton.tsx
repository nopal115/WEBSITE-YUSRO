import { LogOut } from 'lucide-react';

export function LogoutButton({ onLogout, pending, collapsed = false, iconOnly = false, labelClass = '' }: { onLogout: () => void; pending: boolean; collapsed?: boolean; iconOnly?: boolean; labelClass?: string }): JSX.Element {
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
