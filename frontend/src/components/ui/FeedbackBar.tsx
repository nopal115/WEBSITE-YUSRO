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

// SDD 7.3: warna state untuk teks dan ikon, latar memakai -soft. Ukuran dan jarak dari Figma.
const stateStyles: Record<FeedbackState, { bar: string; text: string; button: ButtonVariant }> = {
  benar: { bar: 'bg-feedback-benar-soft', text: 'text-feedback-benar', button: 'benar' },
  salah: { bar: 'bg-feedback-salah-soft', text: 'text-feedback-salah', button: 'salah' },
  // SDD 7.3 hanya menguji state/processing di atas putih (min. 4,5:1) dan tidak punya
  // versi soft, jadi latar diproses memakai neutral/surface.
  diproses: { bar: 'bg-neutral-surface', text: 'text-state-processing', button: 'ghost' },
};

export function FeedbackBar({ state, title, detail, actionLabel, onAction }: FeedbackBarProps): JSX.Element {
  const styles = stateStyles[state];

  return (
    <section className={`fixed inset-x-0 bottom-0 z-20 border-t border-neutral-border px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 md:px-12 md:pb-[calc(2rem+env(safe-area-inset-bottom))] md:pt-8 ${styles.bar}`} aria-live="polite">
      {/* Figma: ikon, teks, dan tombol dalam satu baris dengan gap 24px; teks mengisi sisa lebar. */}
      {/* Di bawah 768 px padding 24/16 dan gap 16 (skala SDD 7.2.2) agar muat di layar 375 px. */}
      <div className="mx-auto flex max-w-[760px] items-center gap-4 md:gap-6">
        {/* Figma: lingkaran ikon 60px putih, glyph H1 bold berwarna state. State diproses tidak punya ikon. */}
        {state !== 'diproses' && (
          <span className={`flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-neutral-surface text-h1 font-bold ${styles.text}`}>
            {state === 'benar' ? '✓' : '✕'}
          </span>
        )}
        <div className={`min-w-0 flex-1 ${styles.text}`}>
          <p className="text-h2">{title}</p>
          {/* Figma: baris detail memakai Body L. */}
          <p className="text-body-l">{detail}</p>
        </div>
        <Button variant={styles.button} onClick={onAction}>{actionLabel}</Button>
      </div>
    </section>
  );
}
