export type PillStatus = 'terkunci' | 'terbuka' | 'selesai' | 'diproses' | 'belum' | 'gagal' | 'perhatian';

interface PillProps {
  status: PillStatus;
  children: string;
}

const statusClasses: Record<PillStatus, string> = {
  terkunci: 'bg-neutral-locked text-text-secondary',
  terbuka: 'bg-brand-primary-soft text-brand-primary',
  selesai: 'bg-feedback-benar-soft text-feedback-benar',
  // SDD 7.3; latar memakai token yang ada karena SDD belum punya varian soft untuk state.
  diproses: 'bg-semantic-warning-soft text-state-processing',
  belum: 'bg-brand-primary-soft text-brand-primary',
  // SDD 7.3.1: kegagalan evaluasi bukan kesalahan santri, jadi tidak merah.
  gagal: 'bg-neutral-surface-alt text-state-failed',
  perhatian: 'bg-semantic-warning-soft text-semantic-warning',
};

export function Pill({ status, children }: PillProps): JSX.Element {
  return (
    <span className={`inline-flex rounded-sm px-3 py-1 text-label ${statusClasses[status]}`}>
      {children}
    </span>
  );
}
