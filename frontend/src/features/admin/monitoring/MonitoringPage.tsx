import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { DataTable, type DataColumn } from '../../../components/ui/DataTable';
import { Pagination } from '../../../components/ui/Pagination';
import type { EvaluationStatus } from '../../../lib/api/types';
import { formatDateTime } from '../../../lib/utils/format';
import { formatScore } from '../../dashboard/view';
import { ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { EvaluationPanel } from './EvaluationPanel';
import { EvaluationStatusLabel } from './EvaluationStatusLabel';
import { GradeModal } from './GradeModal';
import { adminMonitoringKeys, useEvaluationQueue, useSubmissions } from './hooks';
import { MonitoringFilters } from './MonitoringFilters';
import { RecordingPlayer } from './RecordingPlayer';
import { hasMonitoringFilters, parseMonitoringQuery, toMonitoringParams, type MonitoringQuery } from './query';
import type { AdminSubmission } from './types';

const scoreText = (item: AdminSubmission) => (item.score === null ? '—' : formatScore(item.score));
const recordingLabel = (item: AdminSubmission) => `rekaman percobaan ke-${item.attemptNo} ${item.studentName}`;

// Monitoring Evaluasi (SDD 7.7.20, UI-ADMIN-MONITOR-01–03). Filter dan halaman di URL query; tanpa polling.
export function MonitoringPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const query = parseMonitoringQuery(params);
  const submissions = useSubmissions(query);
  const queue = useEvaluationQueue();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [selectedForGrade, setSelectedForGrade] = useState<AdminSubmission | null>(null);

  const update = useCallback(
    (patch: Partial<MonitoringQuery>) => setParams((current) => toMonitoringParams({ ...parseMonitoringQuery(current), ...patch, page: patch.page ?? 1 })),
    [setParams],
  );
  const reset = useCallback(() => setParams(new URLSearchParams()), [setParams]);
  const reload = () => {
    setNotice(null);
    void queryClient.invalidateQueries({ queryKey: adminMonitoringKeys.all });
  };

  const action = (item: AdminSubmission) => {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedForGrade(item)}
          aria-label={`Beri atau ubah nilai percobaan ke-${item.attemptNo} milik ${item.studentName}`}
          className={`min-h-10 whitespace-nowrap rounded-md px-3 font-semibold text-body-s transition ${
            item.evaluationStatus === 'EVALUATED'
              ? 'border border-neutral-border text-brand-primary hover:bg-neutral-surface-alt'
              : 'bg-brand-primary text-white shadow-sm hover:bg-brand-primary/90'
          }`}
        >
          {item.evaluationStatus === 'EVALUATED' ? 'Ubah Nilai' : 'Beri Nilai'}
        </button>
      </div>
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
    { header: 'REKAMAN', render: (item) => <RecordingPlayer submissionId={item.submissionId} label={recordingLabel(item)} /> },
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
        <p className="text-body text-text-secondary">
          {query.status === 'SUBMITTED'
            ? 'Tidak ada rekaman santri yang menunggu dinilai saat ini.'
            : filtered
            ? 'Tidak ada submission yang cocok dengan filter.'
            : 'Belum ada submission.'}
        </p>
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
          compact
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
              <RecordingPlayer submissionId={item.submissionId} label={recordingLabel(item)} />
              <div className="-mx-3 px-3">{action(item)}</div>
            </div>
          )}
        />
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onChange={(page) => update({ page })} label="Halaman daftar submission" />}
      </div>
    );
  }

  const tabs: { label: string; value: EvaluationStatus | ''; count?: number }[] = [
    { label: 'Semua Setoran', value: '' },
    { label: 'Menunggu Dinilai', value: 'SUBMITTED', count: queue.data?.counts.SUBMITTED },
    { label: 'Sudah Dinilai', value: 'EVALUATED', count: queue.data?.counts.EVALUATED },
    { label: 'Gagal Diproses', value: 'FAILED', count: queue.data?.counts.FAILED },
  ];

  return (
    // Panel status di atas tabel selebar penuh: rail kanan 300 px membuat tabel 8 kolom terlalu sempit (temuan QA A3).
    <div className="mx-auto flex max-w-[1364px] flex-col gap-6">
      <h1 className="sr-only">Monitoring Evaluasi</h1>
      <EvaluationPanel />

      {/* Tab Filter Cepat Status */}
      <div className="flex border-b border-neutral-border gap-2 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const isActive = query.status === tab.value;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => update({ status: tab.value, page: 1 })}
              className={`flex items-center gap-2 px-4 py-3 text-body font-semibold border-b-2 whitespace-nowrap transition ${
                isActive
                  ? 'border-brand-primary text-brand-primary bg-neutral-surface'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-neutral-border'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`rounded-full px-2 py-0.5 text-body-s font-bold transition ${
                    tab.value === 'SUBMITTED' && tab.count > 0
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'bg-neutral-surface-alt border border-neutral-border text-text-secondary'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-col gap-6">
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
      {selectedForGrade && (
        <GradeModal
          submission={selectedForGrade}
          onClose={() => setSelectedForGrade(null)}
          onSuccess={(updated) => {
            setNotice({
              tone: 'success',
              text: `Nilai ${updated.score} berhasil disimpan untuk ${updated.studentName}. Status otomatis terupdate!`,
            });
            setSelectedForGrade(null);
          }}
        />
      )}
    </div>
  );
}
