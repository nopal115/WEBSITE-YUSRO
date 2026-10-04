import type { ReactNode } from 'react';

export interface DataColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  /** Kelas tambahan sel isi, mis. "text-h3" atau "whitespace-nowrap". */
  cellClassName?: string;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Judul tabel untuk pembaca layar. */
  caption: string;
  /** Kartu untuk layar < 768 px. */
  renderCard: (row: T) => ReactNode;
}

/**
 * Tabel data bersama: ≥ 768 px berupa tabel (digulir mendatar bila tidak muat, SDD 7.5.1),
 * < 768 px berupa daftar kartu tanpa gulir mendatar (SDD 7.7.13, 7.7.17).
 */
export function DataTable<T>({ columns, rows, rowKey, caption, renderCard }: DataTableProps<T>): JSX.Element {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-md border border-neutral-border bg-neutral-surface md:block">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-neutral-border text-label text-text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.header} scope="col" className="px-5 py-3 font-medium">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-border">
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.header} className={`px-5 py-4 ${column.cellClassName ?? ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>{renderCard(row)}</li>
        ))}
      </ul>
    </>
  );
}
