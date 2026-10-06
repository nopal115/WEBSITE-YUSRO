import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { DataTable, type DataColumn } from '../../../components/ui/DataTable';
import { Pagination } from '../../../components/ui/Pagination';
import { ApiError } from '../../../lib/api/ApiError';
import { formatDateTime } from '../../../lib/utils/format';
import { formatScore } from '../../dashboard/view';
import { ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { EvaluationStatusLabel } from './EvaluationStatusLabel';
import { adminMonitoringKeys, useRetrySubmission, useSubmissions } from './hooks';
import { MonitoringFilters } from './MonitoringFilters';
import { hasMonitoringFilters, parseMonitoringQuery, toMonitoringParams, type MonitoringQuery } from './query';
import type { AdminSubmission } from './types';

const scoreText = (item: AdminSubmission) => (item.score === null ? '—' : formatScore(item.score));
const WAITING = new Set(['SUBMITTED', 'PROCESSING']);

// Monitoring Evaluasi (SDD 7.7.20, UI-ADMIN-MONITOR-01–03). Filter dan halaman di URL query; tanpa polling.
// [REKOMENDASI] Tidak ada desain Figma untuk admin.
export function MonitoringPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const query = parseMonitoringQuery(params);
  const submissions = useSubmissions(query);
  const retry = useRetrySubmission();
  const queryClient = useQueryClient();
  const [scheduled, setScheduled] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const update = useCallback(
    (patch: Partial<MonitoringQuery>) => setParams((current) => toMonitoringParams({ ...parseMonitoringQuery(current), ...patch, page: patch.page ?? 1 })),
    [setParams],
  );
  const reset = useCallback(() => setParams(new URLSearchParams()), [setParams]);
  const reload = () => {
    setNotice(null);
    void queryClient.invalidateQueries({ queryKey: adminMonitoringKeys.all });
  };

  const requestRetry = (item: AdminSubmission) => {
    setNotice(null);
    retry.mutate(item, {
      onSuccess: () => {
        setScheduled((current) => new Set(current).add(item.submissionId));
        setNotice({
          tone: 'success',
          text: `Evaluasi ulang dijadwalkan untuk percobaan ke-${item.attemptNo} milik ${item.studentName}. Nomor percobaan tidak berubah; sistem tidak membuat percobaan baru.`,
        });
      },
      onError: (error) => {
        // 409 EVAL_RETRY_NOT_ALLOWED: status di server sudah berubah; tampilkan pesan lalu muat ulang data.
        setNotice({ tone: 'error', text: error instanceof ApiError ? error.message : 'Terjadi kesalahan. Coba lagi.' });
        void queryClient.invalidateQueries({ queryKey: adminMonitoringKeys.all });
      },
    });
  };

  const action = (item: AdminSubmission) => {
    if (scheduled.has(item.submissionId) && WAITING.has(item.evaluationStatus)) {
      return <span className="whitespace-nowrap text-body-s font-semibold text-state-processing">Dijadwalkan</span>;
    }
    if (item.evaluationStatus !== 'FAILED') return <span className="text-body-s text-text-muted">—</span>;
    const pending = retry.isPending && retry.variables?.submissionId === item.submissionId;
    return (
      <button
        type="button"
        onClick={() => requestRetry(item)}
        disabled={pending}
        aria-label={`Proses ulang percobaan ke-${item.attemptNo} milik ${item.studentName}`}
        className="min-h-11 whitespace-nowrap rounded-md px-3 text-body text-brand-primary hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:text-text-muted"
      >
        {pending ? 'Memproses…' : 'Proses Ulang'}
      </button>
    );
  };

  const columns: DataColumn<AdminSubmission>[] = [
    {
      header: 'SANTRI',
      render: (item) => (
        <div className="min-w-0">
          <p className="text-body font-semibold text-text-primary">{item.studentName}</p>
          <p className="text-body-s text-text-secondary">{item.studentCode}</p>
        </div>
      ),
    },
    {
      header: 'TUGAS',
      render: (item) => (
        <div className="min-w-0 max-w-[16rem]">
          <p className="text-body text-text-primary">{item.taskTitle}</p>
          <p className="text-body-s text-text-secondary">{item.materialTitle}</p>
        </div>
      ),
    },
    { header: 'WAKTU KIRIM', render: (item) => formatDateTime(item.submittedAt), cellClassName: 'whitespace-nowrap text-body-s text-text-secondary' },
    { header: 'PERCOBAAN', render: (item) => `Ke-${item.attemptNo}`, cellClassName: 'whitespace-nowrap text-body' },
    { header: 'STATUS', render: (item) => <EvaluationStatusLabel status={item.evaluationStatus} /> },
    { header: 'NILAI', render: scoreText, cellClassName: 'text-h3' },
    { header: 'AKSI', render: action },
  ];

  const filtered = hasMonitoringFilters(query);
  let content: JSX.Element;
  if (submissions.isPending) {
    content = <ListSkeleton rows={5} />;
  } else if (submissions.isError) {
    content = <ErrorState error={submissions.error} onRetry={() => void submissions.refetch()} backTo="/admin" backLabel="Kembali ke dashboard" />;
  } else if (submissions.data.data.length === 0) {
    content = (
      <div className="flex flex-col items-start gap-4 rounded-md border-2 border-neutral-border bg-neutral-surface p-8">
        <p className="text-body text-text-secondary">{filtered ? 'Tidak ada submission yang cocok dengan filter.' : 'Belum ada submission.'}</p>
        {filtered && (
          <Button variant="outline" onClick={reset}>
            HAPUS FILTER
          </Button>
        )}
      </div>
    );
  } else {
    const { data, meta } = submissions.data;
    content = (
      <div className="flex flex-col gap-6" aria-busy={submissions.isPlaceholderData || undefined}>
        <DataTable
          columns={columns}
          rows={data}
          rowKey={(item) => item.submissionId}
          caption="Daftar submission Dengar-Tirukan"
          renderCard={(item) => (
            <div className="flex flex-col gap-3 rounded-md border border-neutral-border bg-neutral-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-body font-semibold text-text-primary">{item.studentName}</p>
                  <p className="text-body-s text-text-secondary">{item.studentCode}</p>
                </div>
                <EvaluationStatusLabel status={item.evaluationStatus} />
              </div>
              <div>
                <p className="text-body text-text-primary">{item.taskTitle}</p>
                <p className="text-body-s text-text-secondary">{item.materialTitle}</p>
              </div>
              <dl className="grid grid-cols-3 gap-3 text-body-s">
                <div className="col-span-3">
                  <dt className="text-text-muted">Waktu kirim</dt>
                  <dd className="text-text-primary">{formatDateTime(item.submittedAt)}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Percobaan</dt>
                  <dd className="text-h3 text-text-primary">Ke-{item.attemptNo}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Nilai</dt>
                  <dd className="text-h3 text-text-primary">{scoreText(item)}</dd>
                </div>
              </dl>
              <div className="-mx-3 px-3">{action(item)}</div>
            </div>
          )}
        />
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onChange={(page) => update({ page })} label="Halaman daftar submission" />}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1364px] flex-col gap-6">
      <h1 className="sr-only">Monitoring Evaluasi</h1>
      <MonitoringFilters query={query} onChange={update} onReset={reset} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-s text-text-secondary" aria-live="polite">
          {submissions.data?.meta ? `${submissions.data.meta.total} submission` : ''}
        </p>
        <Button variant="outline" onClick={reload} isLoading={submissions.isFetching && !submissions.isPending} loadingText="MEMUAT ULANG…">
          <RefreshCw size={18} className="mr-2" aria-hidden="true" />
          MUAT ULANG
        </Button>
      </div>
      {notice && (
        <p
          className={`rounded-md px-5 py-3 text-body-s ${notice.tone === 'success' ? 'bg-feedback-benar-soft text-feedback-benar' : 'bg-feedback-salah-soft text-feedback-salah'}`}
          role={notice.tone === 'success' ? 'status' : 'alert'}
        >
          {notice.text}
        </p>
      )}
      {content}
    </div>
  );
}
