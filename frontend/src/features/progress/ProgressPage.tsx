import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, ListSkeleton } from '../learning/QueryStates';
import { useProgress } from './hooks';
import { ProgressSummary } from './ProgressSummary';

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
      <ProgressSummary
        data={data}
        afterSummary={
          <Link to="/statistik" className="flex min-h-11 items-center gap-1 self-start text-h3 text-brand-primary hover:underline">
            Lihat statistik
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        }
      />
    </div>
  );
}
