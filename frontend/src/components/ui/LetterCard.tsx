export type LetterCardState = 'default' | 'benar' | 'salah';

interface LetterCardProps {
  letter: string;
  label: string;
  selected: boolean;
  state?: LetterCardState;
  onClick?: () => void;
}

const stateClasses: Record<LetterCardState, string> = {
  default: 'border-neutral-border bg-neutral-surface hover:border-brand-primary',
  benar: 'border-feedback-benar bg-feedback-benar-soft',
  salah: 'border-feedback-salah bg-feedback-salah-soft',
};

export function LetterCard({ letter, label, selected, state = 'default', onClick }: LetterCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-[150px] flex-col items-center justify-center rounded-card border-2 p-5 shadow-sm transition ${stateClasses[state]} ${selected && state === 'default' ? 'border-brand-primary bg-brand-primary-soft' : ''}`}
    >
      {/* SDD 7.4.1: Arab M untuk pilihan jawaban. */}
      <span className="text-arabic-m font-bold text-text-primary" lang="ar" dir="rtl">{letter}</span>
      <span className="mt-2 text-body-s font-bold text-text-secondary">{label}</span>
    </button>
  );
}
