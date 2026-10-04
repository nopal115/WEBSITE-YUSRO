import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, ListSkeleton } from '../learning/QueryStates';
import { HistoryList } from './HistoryList';
import { useHistory } from './hooks';
import { historyLink } from './view';

// SDD 7.7.13 (UI-PROGRESS-02). [REKOMENDASI] Tampilan disusun dari SDD dan UI kit; Figma 19 belum dicocokkan.
export function HistoryPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isPending, isError, error, refetch } = useHistory(page);
  const goTo = (target: number): void => {
    setParams(target > 1 ? { page: String(target) } : {});
    window.scrollTo(0, 0);
  };

  if (isPending) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <ListSkeleton rows={4} />
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

  if (data.data.length === 0) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <EmptyState>Belum ada riwayat. Riwayat muncul setelah Anda mengerjakan tugas pertama.</EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1040px]">
      <HistoryList items={data.data} meta={data.meta} onPageChange={goTo} linkFor={historyLink} label="Halaman riwayat" />
    </div>
  );
}
