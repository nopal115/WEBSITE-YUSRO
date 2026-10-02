export type LetterCardState = 'default' | 'benar' | 'salah';

interface LetterCardProps {
  letter: string;
  label: string;
  selected: boolean;
  state?: LetterCardState;
  onClick?: () => void;
}

// Hanya satu set kelas border/latar yang dipasang, supaya tidak saling menimpa
// lewat urutan CSS.
const stateClasses: Record<Exclude<LetterCardState, 'default'>, string> = {
  benar: 'border-feedback-benar bg-feedback-benar-soft',
  salah: 'border-feedback-salah bg-feedback-salah-soft',
};
const selectedClasses = 'border-brand-primary bg-brand-primary-soft';
const unselectedClasses = 'border-neutral-border bg-neutral-surface hover:border-brand-primary';

export function LetterCard({ letter, label, selected, state = 'default', onClick }: LetterCardProps): JSX.Element {
  const toneClasses = state !== 'default' ? stateClasses[state] : selected ? selectedClasses : unselectedClasses;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-[150px] flex-col items-center justify-center rounded-md border-2 p-5 shadow-card transition ${toneClasses}`}
    >
      {/* SDD 7.4.1: Arab M untuk pilihan jawaban. */}
      <span className="text-arabic-m font-bold text-text-primary" lang="ar" dir="rtl">{letter}</span>
      <span className="mt-2 text-body-s font-bold text-text-secondary">{label}</span>
    </button>
  );
}
