import { Card } from '../../../components/ui/Card';
import { formatDateTime } from '../../../lib/utils/format';
import { ServiceStatusLabel } from '../dashboard/ServiceStatusLabel';
import { ErrorState } from '../../learning/QueryStates';
import { useEvaluationQueue, useServiceHealth } from './hooks';

function Skeleton({ rows }: { rows: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Memuat">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-6 animate-pulse rounded-sm bg-neutral-border motion-reduce:animate-none" />
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-h3 text-text-primary">{value}</dd>
    </div>
  );
}

/**
 * Status evaluasi (UI-ADMIN-MONITOR-02, NFR-AVAIL-02): jumlah per status dari GET admin/evaluation/queue dan
 * kondisi layanan dari GET admin/evaluation/health. Keadaan memuat/galat tiap bagian terpisah dari tabel.
 */
export function EvaluationPanel(): JSX.Element {
  const queue = useEvaluationQueue();
  const health = useServiceHealth();

  return (
    <Card size="panel" className="flex flex-col gap-5">
      <h2 className="text-h3">Status evaluasi</h2>
      <section aria-label="Jumlah per status" className="flex flex-col gap-3">
        {queue.isPending ? (
          <Skeleton rows={4} />
        ) : queue.isError ? (
          <ErrorState error={queue.error} onRetry={() => void queue.refetch()} backTo="/admin" backLabel="Kembali ke dashboard" />
        ) : (
          <>
            <dl className="flex flex-col gap-3 text-body">
              <Row label="Dalam antrean" value={String(queue.data.counts.SUBMITTED)} />
              <Row label="Sedang diproses" value={String(queue.data.counts.PROCESSING)} />
              <Row label="Selesai (24 jam)" value={String(queue.data.counts.EVALUATED)} />
              <Row label="Gagal diproses (24 jam)" value={String(queue.data.counts.FAILED)} />
            </dl>
            {queue.data.oldestWaitingSince && <p className="text-body-s text-text-secondary">Antrean tertua sejak {formatDateTime(queue.data.oldestWaitingSince)}</p>}
          </>
        )}
      </section>
      <section aria-label="Layanan evaluasi" className="flex flex-col gap-3 border-t border-neutral-border pt-4">
        {health.isPending ? (
          <Skeleton rows={2} />
        ) : health.isError ? (
          <ErrorState error={health.error} onRetry={() => void health.refetch()} backTo="/admin" backLabel="Kembali ke dashboard" />
        ) : (
          <dl className="flex flex-col gap-3 text-body">
            <div className="flex flex-col gap-1">
              <dt className="text-text-secondary">Status layanan</dt>
              <dd>
                <ServiceStatusLabel status={health.data.serviceStatus} />
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-text-secondary">Versi model</dt>
              <dd className="min-w-0 break-words text-text-primary">{health.data.modelVersion || '—'}</dd>
            </div>
          </dl>
        )}
      </section>
    </Card>
  );
}
