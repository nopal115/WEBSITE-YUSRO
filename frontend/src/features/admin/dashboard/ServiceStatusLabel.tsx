import { AlertTriangle, CheckCircle2, Hourglass } from 'lucide-react';
import { serviceStatusView, type ServiceTone } from './view';

const SERVICE_ICON: Record<ServiceTone, { icon: typeof CheckCircle2; className: string }> = {
  ok: { icon: CheckCircle2, className: 'text-feedback-benar' },
  loading: { icon: Hourglass, className: 'text-state-processing' },
  down: { icon: AlertTriangle, className: 'text-state-failed' },
};

/** Status layanan evaluasi dengan ikon + teks, bukan warna saja (SDD 7.11). Pemetaan [ASUMSI] AS16. */
export function ServiceStatusLabel({ status }: { status: string | null | undefined }): JSX.Element {
  const view = serviceStatusView(status);
  const { icon: Icon, className } = SERVICE_ICON[view.tone];
  return (
    <span className={`flex items-center gap-2 font-semibold ${className}`}>
      <Icon size={18} aria-hidden="true" />
      {view.label}
    </span>
  );
}
