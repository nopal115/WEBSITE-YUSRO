import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable, type DataColumn } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { Pill } from '../../components/ui/Pill';
import type { PageMeta } from '../../lib/api/types';
import { formatDateTime } from '../../lib/utils/format';
import { formatScore } from '../dashboard/view';
import type { HistoryItem } from './types';
import { historyTone } from './view';

const TASK_TYPE_LABEL = { QUIZ: 'Dengar-Pilih', IMITATION: 'Dengar-Tirukan' } as const;

/** Nilai null (FAILED) tampil "—", bukan 0 (SDD 7.7.13, BR-SCORE-04). */
const scoreText = (item: HistoryItem): string => (item.score === null ? '—' : formatScore(item.score));

function TaskCell({ item, link }: { item: HistoryItem; link: string | null }): JSX.Element {
  const title = <span className="text-body font-semibold text-text-primary">{item.taskTitle}</span>;
  return (
    <div className="min-w-0">
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

interface HistoryListProps {
  items: HistoryItem[];
  meta: PageMeta | null;
  onPageChange: (page: number) => void;
  /** Tautan detail percobaan; null = baris tanpa tautan (mis. tampilan Admin). */
  linkFor?: (item: HistoryItem) => string | null;
  label: string;
}

const noLink = (): null => null;

/** Tabel/kartu riwayat percobaan (SDD 7.7.13), dipakai Riwayat Santri dan Detail Santri (Admin). */
export function HistoryList({ items, meta, onPageChange, linkFor = noLink, label }: HistoryListProps): JSX.Element {
  const columns: DataColumn<HistoryItem>[] = [
    { header: 'TUGAS', render: (item) => <TaskCell item={item} link={linkFor(item)} /> },
    { header: 'PERCOBAAN', render: (item) => `Ke-${item.attemptNo}`, cellClassName: 'text-body' },
    { header: 'NILAI', render: scoreText, cellClassName: 'text-h3' },
    { header: 'STATUS', render: (item) => <Pill status={historyTone(item)}>{item.displayStatus}</Pill> },
    { header: 'WAKTU', render: (item) => formatDateTime(item.submittedAt), cellClassName: 'whitespace-nowrap text-body-s text-text-secondary' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(item) => item.attemptId}
        caption={label}
        renderCard={(item) => {
          const link = linkFor(item);
          return (
            <div className="flex flex-col gap-3 rounded-md border border-neutral-border bg-neutral-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <TaskCell item={item} link={link} />
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
        }}
      />
      {/* [REKOMENDASI] Pagination dari meta; halaman disimpan di URL oleh pemanggil. */}
      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={onPageChange} label={label} />}
    </div>
  );
}
