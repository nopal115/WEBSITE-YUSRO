import { ChevronRight, Lock, LockOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ErrorState, ListSkeleton } from '../learning/QueryStates';
import { useProgress } from './hooks';
import type { ProgressRatio } from './types';

function Companion({ label, ratio }: { label: string; ratio: ProgressRatio }): JSX.Element {
  return (
    <Card>
      <p className="text-label text-text-muted">{label}</p>
      <p className="mt-2 text-h1 text-brand-primary">{ratio.pct}%</p>
      <p className="mt-1 text-body-s text-text-secondary">
        {ratio.completed} dari {ratio.total}
      </p>
    </Card>
  );
}

// SDD 7.7.12 (UI-PROGRESS-01). [REKOMENDASI] Tampilan disusun dari SDD dan UI kit; Figma 19 belum dicocokkan.
export function ProgressPage(): JSX.Element {
  const { data, isPending, isError, error, refetch } = useProgress();

  if (isPending) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <ListSkeleton rows={3} />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      {/* Tiga ukuran progress selalu berlabel; materi dan tugas hanya rincian (BR-PROGRESS-01/02). */}
      <Card>
        <p className="text-label text-text-muted">PROGRESS PEMBELAJARAN</p>
        <p className="mt-2 text-score text-brand-primary">{data.learningProgressPct}%</p>
        <ProgressBar className="mt-4" value={data.learningProgressPct} max={100} />
      </Card>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Companion label="PROGRESS MATERI" ratio={data.materials} />
        <Companion label="PROGRESS TUGAS" ratio={data.tasks} />
      </div>

      <Link to="/statistik" className="flex min-h-11 items-center gap-1 self-start text-h3 text-brand-primary hover:underline">
        Lihat statistik
        <ChevronRight size={20} aria-hidden="true" />
      </Link>

      <section aria-labelledby="progress-tahapan" className="flex flex-col gap-3">
        <h2 id="progress-tahapan" className="text-h3">
          Progress per tahapan
        </h2>
        <ul className="flex flex-col gap-3">
          {data.stages.map((stage) => {
            const locked = stage.access === 'LOCKED';
            const Icon = locked ? Lock : LockOpen;
            return (
              <li key={stage.id} className="rounded-md border border-neutral-border bg-neutral-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-body font-semibold text-text-primary">{stage.title}</p>
                  {/* Hanya Terbuka/Terkunci: field stages tidak memuat status selesai. */}
                  <span className={`flex shrink-0 items-center gap-1 text-label ${locked ? 'text-text-secondary' : 'text-brand-primary'}`}>
                    <Icon size={16} aria-hidden="true" />
                    {locked ? 'Terkunci' : 'Terbuka'}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar className="flex-1" value={stage.pct} max={100} />
                  <span className="w-12 text-right text-body-s text-text-secondary">{stage.pct}%</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
