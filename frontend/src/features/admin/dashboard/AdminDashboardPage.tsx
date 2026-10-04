import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Hourglass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Pill } from '../../../components/ui/Pill';
import { StatTile } from '../../../components/ui/StatTile';
import { formatScore } from '../../dashboard/view';
import { EmptyState, ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { useAdminAttention, useAdminDashboard } from './hooks';
import type { AdminDashboard, AttentionItem, EvaluationHealth } from './types';
import { attentionDetails, reasonLabel, serviceStatusView, type ServiceTone } from './view';

function SummaryCards({ data }: { data: AdminDashboard }): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile label="TOTAL SANTRI" value={String(data.totalStudents)} note={`${data.activeStudents} aktif`} />
      {/* [TBD] SRS FR-DASH-A-01 meminta "jumlah tugas yang dikerjakan", API 5.18 hanya menyediakan jumlah percobaan (attemptsTotal). */}
      <StatTile label="PERCOBAAN TUGAS" value={String(data.attemptsTotal)} />
      <StatTile label="NILAI RATA-RATA" value={data.averageScore === null ? '—' : formatScore(data.averageScore)} note={data.averageScore === null ? 'Belum ada hasil evaluasi.' : undefined} />
      <StatTile label="PROGRESS RATA-RATA" value={`${data.averageProgressPct}%`} />
    </div>
  );
}

const SERVICE_ICON: Record<ServiceTone, { icon: typeof CheckCircle2; className: string }> = {
  ok: { icon: CheckCircle2, className: 'text-feedback-benar' },
  loading: { icon: Hourglass, className: 'text-state-processing' },
  down: { icon: AlertTriangle, className: 'text-state-failed' },
};

/** Kondisi layanan evaluasi (SDD 7.7.16, NFR-AVAIL-02). */
function EvaluationCard({ evaluation }: { evaluation: EvaluationHealth }): JSX.Element {
  const status = serviceStatusView(evaluation.serviceStatus);
  const { icon: StatusIcon, className } = SERVICE_ICON[status.tone];
  const rows: [string, string][] = [
    ['Antrean', String(evaluation.queued)],
    ['Sedang diproses', String(evaluation.processing)],
    ['Gagal 24 jam terakhir', String(evaluation.failedLast24h)],
  ];
  return (
    <Card size="panel" className="flex flex-col gap-4">
      <h2 className="text-h3">Layanan evaluasi</h2>
      <dl className="flex flex-col gap-3 text-body">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="text-text-secondary">{label}</dt>
            <dd className="text-h3 text-text-primary">{value}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <dt className="text-text-secondary">Status layanan</dt>
          {/* Ikon + teks, bukan warna saja (SDD 7.11). */}
          <dd className={`flex items-center gap-2 font-semibold ${className}`}>
            <StatusIcon size={18} aria-hidden="true" />
            {status.label}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-text-secondary">Versi model</dt>
          <dd className="min-w-0 break-words text-text-primary">{evaluation.modelVersion || '—'}</dd>
        </div>
      </dl>
      <Link to="/admin/monitoring" className="flex min-h-11 items-center gap-2 self-start text-body text-brand-primary hover:underline">
        Buka monitoring
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </Card>
  );
}

function AttentionRow({ item }: { item: AttentionItem }): JSX.Element {
  const details = attentionDetails(item);
  return (
    <li>
      <Link
        to={`/admin/santri/${encodeURIComponent(item.studentId)}`}
        className="flex items-center gap-4 rounded-md border border-neutral-border bg-neutral-surface p-4 hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-h3 text-text-primary">{item.name}</span>
            <span className="text-body-s text-text-secondary">{item.studentCode}</span>
          </div>
          {/* Alasan sebagai lencana teks (SDD 7.7.16). */}
          <div className="flex flex-wrap gap-2">
            {item.reasons.map((reason) => (
              <Pill key={reason} status="perhatian">
                {reasonLabel(reason)}
              </Pill>
            ))}
          </div>
          {details.length > 0 && <p className="text-body-s text-text-secondary">{details.join(' · ')}</p>}
        </div>
        <ChevronRight size={20} className="shrink-0 text-brand-primary" aria-hidden="true" />
      </Link>
    </li>
  );
}

function AttentionSection(): JSX.Element {
  const { data, isPending, isError, error, refetch } = useAdminAttention();
  return (
    <section aria-labelledby="perlu-diperhatikan" className="flex flex-col gap-4">
      <h2 id="perlu-diperhatikan" className="text-h3">
        Santri yang perlu diperhatikan
      </h2>
      {isPending ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} backTo="/admin" backLabel="Kembali ke dashboard" />
      ) : data.length === 0 ? (
        <EmptyState>Tidak ada santri yang perlu diperhatikan saat ini.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((item) => (
            <AttentionRow key={item.studentId} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SummarySkeleton(): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy="true" aria-label="Memuat">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="h-28 animate-pulse rounded-md bg-neutral-border motion-reduce:animate-none" />
      ))}
    </div>
  );
}

// Dashboard Admin/Pengajar (SDD 7.7.16, UI-ADMIN-01; SRS FR-DASH-A-01, FR-DASH-A-02).
// [REKOMENDASI] Tampilan disusun dari SDD, UI kit, dan token; tidak ada desain Figma untuk admin.
// [TBD] SDD 7.7.16 menyebut grafik perkembangan, tetapi API 5.18 tidak menyediakan datanya. Grafik per
// santri ditampilkan di Detail Santri (GET /admin/students/:id/chart).
export function AdminDashboardPage(): JSX.Element {
  const summary = useAdminDashboard();

  return (
    <div className="mx-auto flex max-w-[1364px] flex-col gap-6">
      <h1 className="sr-only">Dashboard Admin</h1>
      {summary.isPending ? (
        <SummarySkeleton />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} backTo="/admin" backLabel="Kembali ke dashboard" />
      ) : (
        <SummaryCards data={summary.data} />
      )}
      {/* Desktop: rail kanan 300 px; layar sempit: rail menjadi kartu di bawah isi (SDD 7.5.2). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <AttentionSection />
        {summary.isPending ? (
          <div className="h-80 animate-pulse rounded-lg bg-neutral-border motion-reduce:animate-none" aria-busy="true" aria-label="Memuat" />
        ) : summary.isSuccess ? (
          <EvaluationCard evaluation={summary.data.evaluation} />
        ) : null}
      </div>
    </div>
  );
}
