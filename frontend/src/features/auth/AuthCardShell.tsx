import type { ReactNode } from 'react';
import { Card } from '../../components/ui/Card';

interface AuthCardShellProps {
  children: ReactNode;
  /** register: maks 560 px, padding 56 px; compact (lupa/reset password): maks 460 px, padding 48 px. */
  variant: 'register' | 'compact';
}

const variantClasses = {
  register: 'max-w-[560px] md:p-14',
  compact: 'max-w-[460px] md:p-12',
};

/** Kartu tunggal di tengah layar untuk halaman auth selain login (Figma 02–03). Di mobile padding 24 px. */
export function AuthCardShell({ children, variant }: AuthCardShellProps): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-surface-alt py-12 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <Card size="panel" className={`flex w-full flex-col gap-5 ${variantClasses[variant]}`}>
        {children}
      </Card>
    </div>
  );
}
