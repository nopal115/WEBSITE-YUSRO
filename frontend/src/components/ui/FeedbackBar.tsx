import type { ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';

export type FeedbackState = 'benar' | 'salah' | 'diproses';

interface FeedbackBarProps {
  state: FeedbackState;
  title: string;
  /** ReactNode agar teks Arab di dalamnya bisa diberi lang="ar" dir="rtl" (SDD 7.4.1). */
  detail: ReactNode;
  actionLabel: string;
  onAction?: () => void;
}

const stateStyles: Record<FeedbackState, { bar: string; icon: string; button: ButtonVariant }> = {
  benar: { bar: 'bg-feedback-benar-soft', icon: 'bg-feedback-benar text-text-on-brand', button: 'benar' },
  salah: { bar: 'bg-feedback-salah-soft', icon: 'bg-feedback-salah text-text-on-brand', button: 'salah' },
  diproses: { bar: 'bg-semantic-info-soft', icon: '', button: 'ghost' },
};

export function FeedbackBar({ state, title, detail, actionLabel, onAction }: FeedbackBarProps): JSX.Element {
  const styles = stateStyles[state];

  return (
    <section className={`fixed inset-x-0 bottom-0 z-20 border-t border-neutral-border px-5 py-4 ${styles.bar}`} aria-live="polite">
      <div className="mx-auto flex max-w-[760px] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {state !== 'diproses' && <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl font-bold ${styles.icon}`}>{state === 'benar' ? '✓' : '✕'}</span>}
          <div>
            <p className="text-body font-bold text-text-primary">{title}</p>
            <p className="text-body-s text-text-secondary">{detail}</p>
          </div>
        </div>
        <Button variant={styles.button} onClick={onAction}>{actionLabel}</Button>
      </div>
    </section>
  );
}
