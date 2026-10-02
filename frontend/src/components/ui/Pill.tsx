export type PillStatus = 'terkunci' | 'terbuka' | 'selesai' | 'diproses' | 'belum' | 'gagal' | 'perhatian';

interface PillProps {
  status: PillStatus;
  children: string;
}

const statusClasses: Record<PillStatus, string> = {
  terkunci: 'bg-neutral-locked text-text-secondary',
  terbuka: 'bg-brand-primary-soft text-brand-primary',
  selesai: 'bg-feedback-benar-soft text-feedback-benar',
  diproses: 'bg-semantic-info-soft text-semantic-info',
  belum: 'bg-brand-primary-soft text-brand-primary',
  gagal: 'bg-feedback-salah-soft text-feedback-salah',
  perhatian: 'bg-semantic-warning-soft text-semantic-warning',
};

export function Pill({ status, children }: PillProps): JSX.Element {
  return (
    <span className={`inline-flex rounded-sm px-3 py-1 text-caption font-bold ${statusClasses[status]}`}>
      {children}
    </span>
  );
}
