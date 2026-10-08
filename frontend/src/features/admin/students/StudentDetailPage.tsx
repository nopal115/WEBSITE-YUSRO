import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Pill } from '../../../components/ui/Pill';
import { ApiError } from '../../../lib/api/ApiError';
import { reportFileName, saveBlob } from '../../../lib/utils/download';
import { formatDate, formatDateTime } from '../../../lib/utils/format';
import { EmptyState, ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { HistoryList } from '../../progress/HistoryList';
import { ProgressSummary } from '../../progress/ProgressSummary';
import { StatisticsView } from '../../statistics/StatisticsView';
import { adminStudentsApi } from './api';
import { useStudent, useStudentChart, useStudentHistory, useStudentStatistics } from './hooks';
import type { StudentDetail } from './types';
import { useStatusChange } from './useStatusChange';

const backLink = (
  <Link to="/admin/santri" className="flex min-h-11 items-center gap-2 self-start text-body text-brand-primary hover:underline">
    <ArrowLeft size={20} aria-hidden="true" />
    Daftar santri
  </Link>
);

function ProfileCard({ student, onChangeStatus }: { student: StudentDetail; onChangeStatus: (trigger: HTMLElement) => void }): JSX.Element {
  const report = useMutation({
    mutationFn: () => adminStudentsApi.downloadReport(student.id),
    onSuccess: ({ blob, filename }) => saveBlob(blob, reportFileName(filename, student.studentCode)),
  });
  const active = student.status === 'ACTIVE';
  // SRS UI-ADMIN-STUDENT-03 tidak merinci isi profil; tanggal bergabung dan aktivitas terakhir ditampilkan (keputusan proyek).
  const rows: [string, string][] = [
    ['EMAIL', student.email],
    ['TAHAPAN SAAT INI', student.currentStage?.title ?? '—'],
    ['TANGGAL BERGABUNG', formatDate(student.joinedAt)],
    ['AKTIVITAS TERAKHIR', student.lastActivityAt ? formatDateTime(student.lastActivityAt) : 'Belum ada aktivitas'],
  ];

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-h2">{student.name}</h1>
          <p className="text-body-s text-text-secondary">{student.studentCode}</p>
        </div>
        <Pill status={active ? 'selesai' : 'terkunci'}>{active ? 'Aktif' : 'Nonaktif'}</Pill>
      </div>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-label text-text-muted">{label}</dt>
            <dd className="mt-1 break-words text-body text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      {report.isError && (
        <p className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
          {report.error instanceof ApiError ? report.error.message : 'Terjadi kesalahan. Coba lagi.'}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button variant={active ? 'salah' : 'primary'} onClick={(event) => onChangeStatus(event.currentTarget)}>
          {active ? 'NONAKTIFKAN AKUN' : 'AKTIFKAN AKUN'}
        </Button>
        <Button variant="outline" isLoading={report.isPending} loadingText="MENYIAPKAN…" onClick={() => report.mutate()}>
          UNDUH PDF
        </Button>
        {/* Rekaman tidak diputar di sini; diputar di Monitoring (A3) yang meminta URL berbatas waktu (SDD 3.17.4). */}
        <Link to={`/admin/monitoring?studentId=${encodeURIComponent(student.id)}`} className="flex min-h-11 items-center gap-2 px-2 text-body text-brand-primary hover:underline">
          Lihat rekaman
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}

function StatisticsSection({ id }: { id: string }): JSX.Element {
  const stats = useStudentStatistics(id);
  const chart = useStudentChart(id);
  return (
    <section aria-labelledby="statistik-santri" className="flex flex-col gap-4">
      <h2 id="statistik-santri" className="text-h3">
        Statistik
      </h2>
      {stats.isPending ? <ListSkeleton rows={1} /> : stats.isError ? <ErrorState error={stats.error} onRetry={() => void stats.refetch()} backTo="/admin/santri" backLabel="Kembali ke daftar santri" /> : <StatisticsView stats={stats.data} chart={chart} />}
    </section>
  );
}

function HistorySection({ id }: { id: string }): JSX.Element {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1);
  const history = useStudentHistory(id, page);
  const goTo = (target: number) => setParams(target > 1 ? { page: String(target) } : {});
  return (
    <section aria-labelledby="riwayat-santri" className="flex flex-col gap-4">
      <h2 id="riwayat-santri" className="text-h3">
        Riwayat tugas
      </h2>
      {history.isPending ? (
        <ListSkeleton rows={3} />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} backTo="/admin/santri" backLabel="Kembali ke daftar santri" />
      ) : history.data.data.length === 0 ? (
        <EmptyState>Belum ada riwayat pengerjaan tugas.</EmptyState>
      ) : (
        // Tanpa tautan per percobaan: detail percobaan untuk Admin belum ada.
        <HistoryList items={history.data.data} meta={history.data.meta} onPageChange={goTo} label="Halaman riwayat santri" />
      )}
    </section>
  );
}

// Detail Santri (UI-ADMIN-STUDENT-03, SRS FR-STUDENT-06, FR-MONITOR-03/04, FR-REPORT-03). Dimuat terpisah
// (React.lazy) karena grafik memakai Recharts. [REKOMENDASI] Tidak ada desain Figma untuk admin.
export function StudentDetailPage(): JSX.Element {
  const id = useParams().studentId ?? '';
  const student = useStudent(id);
  const statusChange = useStatusChange();

  if (student.isPending) {
    return (
      <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
        {backLink}
        <ListSkeleton rows={3} />
      </div>
    );
  }
  if (student.isError) {
    // 404: santri tidak ditemukan; tanpa COBA LAGI.
    return (
      <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
        {backLink}
        <ErrorState error={student.error} onRetry={() => void student.refetch()} backTo="/admin/santri" backLabel="Kembali ke daftar santri" />
      </div>
    );
  }

  const data = student.data;
  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      {backLink}
      {statusChange.notice && (
        <p className="rounded-md bg-feedback-benar-soft px-5 py-3 text-body-s text-feedback-benar" role="status">
          {statusChange.notice}
        </p>
      )}
      <ProfileCard student={data} onChangeStatus={(trigger) => statusChange.open({ id: data.id, name: data.name, status: data.status }, trigger)} />
      <section aria-labelledby="progress-santri" className="flex flex-col gap-6">
        <h2 id="progress-santri" className="text-h3">
          Progress
        </h2>
        <ProgressSummary data={data.progress} />
      </section>
      <StatisticsSection id={data.id} />
      <HistorySection id={data.id} />
      {statusChange.dialog}
    </div>
  );
}
