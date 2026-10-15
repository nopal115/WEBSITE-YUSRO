import { AlertTriangle, CheckCircle2, Hourglass, Loader } from 'lucide-react';
import type { EvaluationStatus } from '../../../lib/api/types';

// [REKOMENDASI] Label status untuk Admin (UI-ADMIN-MONITOR-02). Ikon + teks, bukan warna saja (SDD 7.11);
// FAILED memakai state/failed, bukan merah (SDD 7.3.1).
const VIEW: Record<EvaluationStatus, { label: string; icon: typeof Hourglass; className: string }> = {
  SUBMITTED: { label: 'Dalam antrean', icon: Hourglass, className: 'text-state-processing' },
  PROCESSING: { label: 'Sedang diproses', icon: Loader, className: 'text-state-processing' },
  EVALUATED: { label: 'Selesai', icon: CheckCircle2, className: 'text-feedback-benar' },
  FAILED: { label: 'Gagal diproses', icon: AlertTriangle, className: 'text-state-failed' },
};

export function EvaluationStatusLabel({ status }: { status: EvaluationStatus }): JSX.Element {
  const { label, icon: Icon, className } = VIEW[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-body-s font-semibold ${className}`}>
      <Icon size={16} aria-hidden="true" />
      {label}
    </span>
  );
}
