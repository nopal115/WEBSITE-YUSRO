import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { useStageMaterials } from './hooks';
import { EmptyState, ErrorState, ListSkeleton } from './QueryStates';
import { materialRow } from './status';
import type { MaterialSummary } from './types';

const badgeColor: Record<MaterialSummary['status'], string> = {
  COMPLETED: 'text-feedback-benar',
  AVAILABLE: 'text-brand-primary',
  LOCKED: 'text-text-secondary',
};

function MaterialItem({ material, number }: { material: MaterialSummary; number: number }): JSX.Element {
  const row = materialRow(material);
  const visual = row.canOpen ? '' : 'opacity-60';
  const content = (
    <Card className="flex items-center gap-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-surface-alt text-h3 text-text-primary ${visual}`} aria-hidden="true">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className={visual}>
          <h2 className="text-h3 text-text-primary">{material.title}</h2>
          <span className={`mt-1 flex items-center gap-1 text-label ${badgeColor[material.status]}`}>
            <row.badge.icon size={16} aria-hidden="true" />
            {row.badge.label}
            {material.taskCount !== undefined && <span className="text-text-secondary">· {material.tasksCompleted ?? 0}/{material.taskCount} tugas</span>}
          </span>
        </div>
        {/* lockReason tetap berkontras penuh (SDD 7.11, NFR-USE-03). */}
        {!row.canOpen && material.lockReason && <p className="mt-2 text-body-s text-text-secondary">{material.lockReason}</p>}
      </div>
      {row.actionLabel && (
        <span className="flex shrink-0 items-center gap-1 text-body text-brand-primary">
          {row.actionLabel}
          <ChevronRight size={20} aria-hidden="true" />
        </span>
      )}
    </Card>
  );

  return row.canOpen ? (
    <Link to={`/materi/${material.id}`} className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
      {content}
    </Link>
  ) : (
    <div aria-disabled="true">{content}</div>
  );
}

// SDD 7.7.6 (UI-LEARN-02). [REKOMENDASI] Tampilan disusun dari SDD dan UI kit; dicocokkan dengan Figma nanti.
export function StageMaterialsPage(): JSX.Element {
  const stageId = useParams().stageId ?? '';
  const { data, isPending, isError, error, refetch } = useStageMaterials(stageId);

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      <Link to="/belajar" className="flex min-h-11 items-center gap-2 self-start text-body text-brand-primary hover:underline">
        <ArrowLeft size={20} aria-hidden="true" />
        Daftar tahapan
      </Link>
      {isPending ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <h1 className="text-h2 text-text-primary">{data.stage.title}</h1>
          {data.materials.length === 0 ? (
            <EmptyState>Tahapan ini belum memiliki materi.</EmptyState>
          ) : (
            <ol className="flex flex-col gap-4">
              {data.materials.map((material, index) => (
                <li key={material.id}>
                  <MaterialItem material={material} number={index + 1} />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
