import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ErrorState } from '../learning/QueryStates';
import { useDashboard } from './hooks';
import type { DashboardData } from './types';
import { dashboardCta, formatScore } from './view';

// SDD 7.5: isi utama maksimal 1040 px dan rail 300 px di desktop; di mobile satu kolom dan rail
// menjadi kartu di bawah isi. Sapaan melintang dua kolom sehingga rail sejajar dengan kartu pertama.
const GRID = 'mx-auto grid max-w-[1380px] grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1040px)_300px] lg:gap-x-10 lg:gap-y-8';

function DashboardContent({ data }: { data: DashboardData }): JSX.Element {
  const navigate = useNavigate();
  const cta = dashboardCta(data);

  return (
    <div className={GRID}>
      <header className="lg:col-span-2">
        {/* Menyimpang dari wireframe SDD 7.7.4 atas keputusan pemilik dokumen; SDD akan disesuaikan. */}
        {/* [REKOMENDASI] SDD belum mengatur tipografi mobile: H1 di bawah 768 px, Display di atasnya. */}
        <h1 className="break-words text-h1 md:text-display">Assalamu&apos;alaikum, {data.greeting.name}</h1>
        <p className="mt-2 text-body-l text-text-secondary">{data.greeting.studentCode}</p>
      </header>

      <div className="min-w-0 space-y-6 lg:space-y-8">
        {/* Isi mengikuti wireframe SDD 7.7.4; gaya panel mengikuti Figma. */}
        <section className="rounded-lg bg-brand-primary p-8 text-text-on-brand shadow-[0_6px_0_theme(colors.brand.primary-hover)]">
          <p className="text-label text-brand-accent">PROGRESS PEMBELAJARAN</p>
          <p className="mt-2 text-score">{data.learningProgressPct}%</p>
          <ProgressBar className="mt-4" value={data.learningProgressPct} max={100} color="accent" />

          <p className="mt-8 text-label text-brand-accent">MATERI TERAKHIR</p>
          {data.lastMaterial ? (
            <div className="mt-2">
              <h2 className="text-h2">{data.lastMaterial.title}</h2>
              <p className="mt-1 text-body text-text-on-brand opacity-75">{data.lastMaterial.stageTitle}</p>
            </div>
          ) : (
            <p className="mt-2 text-body text-text-on-brand opacity-75">Belum ada materi yang Anda buka. Mulai dari Tahapan 1.</p>
          )}

          {/* Satu-satunya ajakan bertindak utama (SDD 7.7.4). */}
          {cta.kind === 'finished' ? (
            <p className="mt-8 text-body">
              Semua materi telah selesai.{' '}
              <Link to="/progress" className="font-semibold underline">
                Lihat progress
              </Link>
            </p>
          ) : (
            <Button className="mt-8 w-full" variant="accent" onClick={() => navigate(`/materi/${cta.materialId}`)}>
              {cta.kind === 'start' ? 'MULAI BELAJAR' : 'LANJUTKAN PEMBELAJARAN'}
            </Button>
          )}
        </section>

        <Card>
          <h2 className="text-label text-text-muted">TUGAS BELUM SELESAI</h2>
          {data.unfinishedTasks.length === 0 ? (
            <p className="mt-4 text-body text-text-secondary">Tidak ada tugas yang belum selesai.</p>
          ) : (
            // [TBD] Tanpa tombol Buka: kontrak unfinishedTasks belum memuat jenis tugas dan materialId,
            // sehingga tidak bisa ditautkan ke /tugas/:taskId/pilih atau /tirukan (temuan untuk backend).
            <ul className="mt-5 space-y-3">
              {data.unfinishedTasks.map((task) => (
                <li key={task.id} className="rounded-md bg-neutral-surface-alt p-5">
                  <h3 className="text-h3">{task.title}</h3>
                  <p className="mt-1 text-body-s text-text-secondary">{task.materialTitle}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <h2 className="text-label text-text-muted">RINGKASAN</h2>
          <dl className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-body text-text-secondary">Materi selesai</dt>
              <dd className="text-h3">{data.materialsCompleted}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-body text-text-secondary">Tugas selesai</dt>
              <dd className="text-h3">{data.tasksCompleted}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-label text-text-muted">NILAI TERAKHIR</h2>
          {data.lastAttemptScore ? (
            <>
              {/* Nilai percobaan terakhir, bukan nilai terbaik (SDD 3.14.4); warna netral karena kategori tidak dikirim. */}
              <p className="mt-2 text-score text-brand-primary">{formatScore(data.lastAttemptScore.score)}</p>
              <p className="mt-2 text-body-s text-text-secondary">{data.lastAttemptScore.taskTitle}</p>
            </>
          ) : (
            <p className="mt-4 text-body text-text-secondary">Belum ada nilai. Nilai muncul setelah Anda mengerjakan tugas pertama.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton(): JSX.Element {
  const bar = 'rounded-sm bg-neutral-border';
  return (
    <div className={GRID} aria-busy="true" aria-label="Memuat">
      <div className="animate-pulse space-y-3 motion-reduce:animate-none lg:col-span-2">
        <div className={`h-10 w-2/3 ${bar}`} />
        <div className={`h-5 w-32 ${bar}`} />
      </div>
      <div className="space-y-6">
        <div className="h-72 animate-pulse rounded-lg bg-neutral-border motion-reduce:animate-none" />
        <div className="h-40 animate-pulse rounded-md bg-neutral-border motion-reduce:animate-none" />
      </div>
      <div className="space-y-6">
        <div className="h-36 animate-pulse rounded-md bg-neutral-border motion-reduce:animate-none" />
        <div className="h-36 animate-pulse rounded-md bg-neutral-border motion-reduce:animate-none" />
      </div>
    </div>
  );
}

// SDD 7.7.4 / FR-DASH-S-01. [REKOMENDASI] Elemen Figma tanpa sumber data di API disembunyikan.
export function DashboardPage(): JSX.Element {
  const { data, isPending, isError, error, refetch } = useDashboard();
  if (isPending) return <DashboardSkeleton />;
  if (isError) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  return <DashboardContent data={data} />;
}
