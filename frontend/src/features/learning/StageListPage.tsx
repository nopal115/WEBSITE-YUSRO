import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useStages } from './hooks';
import { EmptyState, ErrorState, ListSkeleton } from './QueryStates';
import { stageBadge } from './status';
import type { StageSummary } from './types';

const badgeColor = { Selesai: 'text-feedback-benar', Terbuka: 'text-brand-primary', Terkunci: 'text-text-secondary' } as const;

function StageCardContent({ stage }: { stage: StageSummary }): JSX.Element {
  const badge = stageBadge(stage);
  const locked = stage.access === 'LOCKED';
  // Tahapan terkunci: opasitas rendah hanya untuk elemen visual; lockReason tetap berkontras penuh (SDD 7.11).
  const visual = locked ? 'opacity-60' : '';
  return (
    <Card>
      <div className={`flex items-start justify-between gap-4 ${visual}`}>
        <h2 className="text-h3 text-text-primary">{stage.title}</h2>
        <span className={`flex shrink-0 items-center gap-1 text-label ${badgeColor[badge.label as keyof typeof badgeColor]}`}>
          <badge.icon size={18} aria-hidden="true" />
          {badge.label}
        </span>
      </div>
      <div className={visual}>
        <p className="mt-2 text-body-s text-text-secondary">
          {stage.materialsCompleted} dari {stage.materialsTotal} materi
        </p>
        <ProgressBar className="mt-3" value={stage.materialsCompleted} max={stage.materialsTotal} />
      </div>
      {locked && stage.lockReason && <p className="mt-4 text-body-s text-text-secondary">{stage.lockReason}</p>}
    </Card>
  );
}

// SDD 7.7.5 (UI-LEARN-01). [REKOMENDASI] Tampilan disusun dari SDD dan UI kit; dicocokkan dengan Figma nanti.
export function StageListPage(): JSX.Element {
  const { data, isPending, isError, error, refetch } = useStages();

  return (
    <div className="mx-auto max-w-[1040px]">
      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState>Belum ada tahapan pembelajaran. Tahapan akan muncul setelah pengajar menambahkannya.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {data.map((stage) => (
            <li key={stage.id}>
              {stage.access === 'LOCKED' ? (
                // Tidak dapat ditekan (SDD 7.7.5).
                <div aria-disabled="true">
                  <StageCardContent stage={stage} />
                </div>
              ) : (
                <Link to={`/belajar/${stage.id}`} className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
                  <StageCardContent stage={stage} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
