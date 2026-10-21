import { Download } from 'lucide-react';
import { usePwaInstall } from '../../lib/pwa/usePwaInstall';

interface InstallPwaButtonProps {
  className?: string;
  variant?: 'button' | 'banner';
}

export function InstallPwaButton({ className = '', variant = 'button' }: InstallPwaButtonProps): JSX.Element | null {
  const { isInstallable, install } = usePwaInstall();

  if (!isInstallable) return null;

  if (variant === 'banner') {
    return (
      <div className={`flex items-center justify-between gap-3 rounded-md border border-brand-primary-line bg-brand-primary-soft p-3 text-text-primary ${className}`}>
        <div className="flex items-center gap-2.5">
          <Download size={20} className="shrink-0 text-brand-primary" aria-hidden="true" />
          <p className="text-body-s font-medium">Install aplikasi Yusro untuk akses lebih cepat dan mudah di HP</p>
        </div>
        <button
          type="button"
          onClick={() => void install()}
          className="shrink-0 rounded bg-brand-primary px-3 py-1.5 text-body-s font-semibold text-text-on-brand hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
        >
          Install
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void install()}
      aria-label="Install aplikasi Yusro ke layar utama perangkat Anda"
      className={`flex items-center gap-2 rounded-md border border-brand-primary bg-brand-primary-soft px-3 py-2 text-body-s font-semibold text-brand-primary hover:bg-brand-primary-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary transition-colors ${className}`}
    >
      <Download size={18} aria-hidden="true" />
      <span>Install Aplikasi</span>
    </button>
  );
}
