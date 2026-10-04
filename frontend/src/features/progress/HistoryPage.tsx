import { ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { formatDateTime } from '../../lib/utils/format';
import { formatScore } from '../dashboard/view';
import { EmptyState, ErrorState, ListSkeleton } from '../learning/QueryStates';
import { useHistory } from './hooks';
import type { HistoryItem } from './types';
import { historyLink, historyTone } from './view';

const TASK_TYPE_LABEL = { QUIZ: 'Dengar-Pilih', IMITATION: 'Dengar-Tirukan' } as const;

/** Nilai null (FAILED) tampil "—", bukan 0 (SDD 7.7.13, BR-SCORE-04). */
const scoreText = (item: HistoryItem): string => (item.score === null ? '—' : formatScore(item.score));

function TaskCell({ item }: { item: HistoryItem }): JSX.Element {
  const link = historyLink(item);
  const title = <span className="text-body font-semibold text-text-primary">{item.taskTitle}</span>;
  return (
    <div className="min-w-0">
      {/* [TBD] Baris Dengar-Tirukan belum bertaut; detailnya dibangun bersama Dengar-Tirukan. */}
      {link ? (
        <Link to={link} className="text-brand-primary hover:underline">
          {title}
        </Link>
      ) : (
        title
      )}
      <p className="text-body-s text-text-secondary">
        {TASK_TYPE_LABEL[item.taskType]} · {item.materialTitle}
      </p>
    </div>
  );
}

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

  const items = data.data;
  const meta = data.meta;
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <EmptyState>Belum ada riwayat. Riwayat muncul setelah Anda mengerjakan tugas pertama.</EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      {/* ≥ 768 px: tabel. */}
      <div className="hidden overflow-hidden rounded-md border border-neutral-border bg-neutral-surface md:block">
        <table className="w-full text-left">
          <thead className="border-b border-neutral-border text-label text-text-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">TUGAS</th>
              <th scope="col" className="px-5 py-3 font-medium">PERCOBAAN</th>
              <th scope="col" className="px-5 py-3 font-medium">NILAI</th>
              <th scope="col" className="px-5 py-3 font-medium">STATUS</th>
              <th scope="col" className="px-5 py-3 font-medium">WAKTU</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-border">
            {items.map((item) => (
              <tr key={item.attemptId}>
                <td className="px-5 py-4">
                  <TaskCell item={item} />
                </td>
                <td className="px-5 py-4 text-body">Ke-{item.attemptNo}</td>
                <td className="px-5 py-4 text-h3">{scoreText(item)}</td>
                <td className="px-5 py-4">
                  <Pill status={historyTone(item)}>{item.displayStatus}</Pill>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-body-s text-text-secondary">{formatDateTime(item.submittedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* < 768 px: daftar kartu tanpa gulir mendatar (SDD 7.7.13). */}
      <ul className="flex flex-col gap-3 md:hidden">
        {items.map((item) => {
          const link = historyLink(item);
          const content = (
            <div className="flex flex-col gap-3 rounded-md border border-neutral-border bg-neutral-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <TaskCell item={item} />
                {link && <ChevronRight size={20} className="shrink-0 text-brand-primary" aria-hidden="true" />}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-s text-text-secondary">
                <span>Percobaan ke-{item.attemptNo}</span>
                <span>
                  Nilai <span className="text-h3 text-text-primary">{scoreText(item)}</span>
                </span>
                <Pill status={historyTone(item)}>{item.displayStatus}</Pill>
              </div>
              <p className="text-body-s text-text-secondary">{formatDateTime(item.submittedAt)}</p>
            </div>
          );
          return <li key={item.attemptId}>{content}</li>;
        })}
      </ul>

      {/* [REKOMENDASI] Pagination dari meta; halaman disimpan di URL (?page=). */}
      {meta && meta.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Halaman riwayat">
          <Button variant="outline" disabled={page <= 1} onClick={() => goTo(page - 1)}>
            SEBELUMNYA
          </Button>
          <span className="text-body-s text-text-secondary">
            Halaman {meta.page} dari {meta.totalPages}
          </span>
          <Button variant="outline" disabled={page >= meta.totalPages} onClick={() => goTo(page + 1)}>
            BERIKUTNYA
          </Button>
        </nav>
      )}
    </div>
  );
}
