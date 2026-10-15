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

function Count({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="rounded-md border border-neutral-border p-3">
      <dt className="text-body-s text-text-secondary">{label}</dt>
      <dd className="mt-1 text-h2 text-text-primary">{value}</dd>
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
      {/* Desktop: jumlah per status dan kondisi layanan berdampingan; layar sempit: bertumpuk. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-label="Jumlah per status" className="flex flex-col gap-3">
          {queue.isPending ? (
            <Skeleton rows={4} />
          ) : queue.isError ? (
            <ErrorState error={queue.error} onRetry={() => void queue.refetch()} backTo="/admin" backLabel="Kembali ke dashboard" />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Count label="Dalam antrean" value={queue.data.counts.SUBMITTED} />
                <Count label="Sedang diproses" value={queue.data.counts.PROCESSING} />
                <Count label="Selesai (24 jam)" value={queue.data.counts.EVALUATED} />
                <Count label="Gagal diproses (24 jam)" value={queue.data.counts.FAILED} />
              </dl>
              {queue.data.oldestWaitingSince && <p className="text-body-s text-text-secondary">Antrean tertua sejak {formatDateTime(queue.data.oldestWaitingSince)}</p>}
            </>
          )}
        </section>
        <section aria-label="Layanan evaluasi" className="flex flex-col gap-3 border-t border-neutral-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
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
      </div>
    </Card>
  );
}
