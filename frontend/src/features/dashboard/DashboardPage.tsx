import { Award, CheckCircle2, ChevronRight, Download, Flame } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { saveBlob } from '../../lib/utils/download';
import { ErrorState } from '../learning/QueryStates';
import { reportApi } from '../report/api';
import { useDashboard } from './hooks';
import type { DashboardData } from './types';
import { dashboardCta, formatScore } from './view';

const GRID = 'mx-auto grid max-w-[1380px] grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1040px)_300px] lg:gap-x-10 lg:gap-y-8';

function CertificateCard({ stages, studentCode }: { stages: NonNullable<DashboardData['completedStages']>; studentCode: string }): JSX.Element | null {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (!stages || stages.length === 0) return null;

  const handleDownload = async (stageId: string, stageTitle: string) => {
    try {
      setDownloadingId(stageId);
      const { blob, filename } = await reportApi.downloadCertificate(stageId);
      saveBlob(blob, filename ?? `Syahadah-${studentCode}-${stageTitle.replace(/\s+/g, '_')}.pdf`);
    } catch {
      alert('Gagal mengunduh syahadah. Silakan coba beberapa saat lagi.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card className="border-brand-accent bg-brand-accent-soft/30">
      <div className="flex items-center gap-2">
        <Award size={22} className="text-brand-accent" aria-hidden="true" />
        <h2 className="text-h3 text-brand-primary">Syahadah Tahapan</h2>
      </div>
      <p className="mt-1 text-body-s text-text-secondary">
        Selamat! Anda telah menyelesaikan tahapan pembelajaran. Unduh sertifikat kelulusan resmi Anda:
      </p>
      <div className="mt-3 space-y-2">
        {stages.map((stg) => (
          <div key={stg.stageId} className="flex items-center justify-between gap-3 rounded-md border border-neutral-border bg-neutral-surface p-3">
            <span className="text-body-s font-semibold text-text-primary">{stg.stageTitle}</span>
            <Button
              variant="outline"
              className="min-h-0 px-3 py-1.5 text-caption font-bold"
              isLoading={downloadingId === stg.stageId}
              loadingText="MENGUNDUH…"
              onClick={() => void handleDownload(stg.stageId, stg.stageTitle)}
            >
              <Download size={14} className="mr-1.5" />
              UNDUH SYAHADAH
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function StreakAndTargetSection({ data }: { data: DashboardData }): JSX.Element {
  const streak = data.streak ?? { days: 0, activeToday: false };
  const target = data.dailyTarget ?? {
    targetMaterials: 1,
    completedMaterialsToday: 0,
    targetTasks: 1,
    completedTasksToday: 0,
    isTargetMet: false,
  };

  return (
    <Card>
      {/* Keistiqamahan / Streak */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={24} className={streak.days > 0 ? 'fill-brand-accent text-brand-accent' : 'text-text-muted'} aria-hidden="true" />
          <h2 className="text-h3 text-text-primary">Keistiqamahan Belajar</h2>
        </div>
        <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-body-s font-bold text-brand-primary">
          {streak.days} Hari Berturut-turut
        </span>
      </div>

      <p className="mt-2 text-body-s text-text-secondary">
        {streak.activeToday
          ? 'Alhamdulillah! Hari ini Anda sudah belajar dan menjaga keistiqamahan.'
          : 'Yuk selesaikan materi atau kuis hari ini agar streak Anda tetap menyala!'}
      </p>

      {/* Target Harian */}
      <div className="mt-4 border-t border-neutral-border pt-4">
        <div className="flex items-center justify-between">
          <span className="text-label text-text-muted">TARGET HARI INI</span>
          {target.isTargetMet && (
            <span className="flex items-center gap-1 rounded bg-feedback-benar-soft px-2 py-0.5 text-caption font-semibold text-feedback-benar">
              <CheckCircle2 size={14} /> Tercapai
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className={`flex items-center gap-2 rounded-md border p-2.5 ${target.completedMaterialsToday >= 1 ? 'border-feedback-benar/30 bg-feedback-benar-soft/40' : 'border-neutral-border bg-neutral-surface-alt'}`}>
            <CheckCircle2 size={18} className={target.completedMaterialsToday >= 1 ? 'text-feedback-benar' : 'text-text-muted'} />
            <div className="min-w-0">
              <p className="text-caption text-text-muted">1 Materi</p>
              <p className="text-body-s font-semibold text-text-primary">{target.completedMaterialsToday} / 1 Selesai</p>
            </div>
          </div>

          <div className={`flex items-center gap-2 rounded-md border p-2.5 ${target.completedTasksToday >= 1 ? 'border-feedback-benar/30 bg-feedback-benar-soft/40' : 'border-neutral-border bg-neutral-surface-alt'}`}>
            <CheckCircle2 size={18} className={target.completedTasksToday >= 1 ? 'text-feedback-benar' : 'text-text-muted'} />
            <div className="min-w-0">
              <p className="text-caption text-text-muted">1 Tugas / Kuis</p>
              <p className="text-body-s font-semibold text-text-primary">{target.completedTasksToday} / 1 Selesai</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DashboardContent({ data }: { data: DashboardData }): JSX.Element {
  const navigate = useNavigate();
  const cta = dashboardCta(data);

  return (
    <div className={GRID}>
      <header className="lg:col-span-2">
        <h1 className="break-words text-h1 md:text-display">Assalamu&apos;alaikum, {data.greeting.name}</h1>
        <p className="mt-2 text-body-l text-text-secondary">{data.greeting.studentCode}</p>
      </header>

      <div className="min-w-0 space-y-6 lg:space-y-8">
        {/* Banner Keistiqamahan & Target Harian */}
        <StreakAndTargetSection data={data} />

        {/* Syahadah jika ada tahapan yang selesai */}
        {data.completedStages && data.completedStages.length > 0 && (
          <CertificateCard stages={data.completedStages} studentCode={data.greeting.studentCode} />
        )}

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
            <ul className="mt-5 space-y-3">
              {data.unfinishedTasks.map((task) => {
                const targetPath = task.type === 'IMITATION' ? `/tugas/${task.id}/tirukan` : `/tugas/${task.id}/pilih`;
                const typeLabel = task.type === 'IMITATION' ? 'Dengar-Tirukan' : 'Dengar-Pilih';

                return (
                  <li key={task.id}>
                    <Link
                      to={targetPath}
                      className="flex items-center justify-between gap-4 rounded-md border border-neutral-border bg-neutral-surface-alt p-4 transition hover:bg-neutral-surface hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-h3 text-text-primary">{task.title}</h3>
                          <span className="rounded bg-brand-primary/10 px-2 py-0.5 text-body-s font-medium text-brand-primary">
                            {typeLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-body-s text-text-secondary">{task.materialTitle}</p>
                      </div>
                      <ChevronRight size={20} className="shrink-0 text-brand-primary" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
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
        <div className="h-44 animate-pulse rounded-lg bg-neutral-border motion-reduce:animate-none" />
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
