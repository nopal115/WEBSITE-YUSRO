import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, ListSkeleton } from '../learning/QueryStates';
import { useStatistics, useStatisticsChart } from '../progress/hooks';
import { StatisticsView } from './StatisticsView';

// SDD 7.7.14 (UI-STAT-01, UI-STAT-02). [REKOMENDASI] Tampilan disusun dari SDD dan UI kit; Figma 19 belum dicocokkan.
export function StatisticsPage(): JSX.Element {
  const stats = useStatistics();
  const chart = useStatisticsChart();

  const back = (
    <Link to="/progress" className="flex min-h-11 items-center gap-2 self-start text-body text-brand-primary hover:underline">
      <ArrowLeft size={20} aria-hidden="true" />
      Progress
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      {back}
      {stats.isPending ? (
        <ListSkeleton rows={2} />
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <StatisticsView stats={stats.data} chart={chart} />
      )}
    </div>
  );
}
