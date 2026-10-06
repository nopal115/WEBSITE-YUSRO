import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { DataTable, type DataColumn } from '../../../components/ui/DataTable';
import { Pagination } from '../../../components/ui/Pagination';
import { Pill } from '../../../components/ui/Pill';
import { SelectField } from '../../../components/ui/SelectField';
import { formatScore } from '../../dashboard/view';
import { ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { useStudents } from './hooks';
import { DEFAULT_SORT, hasActiveFilters, parseStudentQuery, SORT_OPTIONS, toSearchParams, type StudentQuery } from './query';
import { StudentFilters } from './StudentFilters';
import type { StudentListItem } from './types';
import { useStatusChange } from './useStatusChange';

const scoreText = (item: StudentListItem) => (item.averageScore === null ? '—' : formatScore(item.averageScore));

function StatusPill({ status }: { status: StudentListItem['status'] }): JSX.Element {
  return <Pill status={status === 'ACTIVE' ? 'selesai' : 'terkunci'}>{status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}</Pill>;
}

/** Email panjang dipotong dengan elipsis; teks lengkap tetap ada di DOM (dibaca pembaca layar) dan di title. */
function EmailText({ email, className = '' }: { email: string; className?: string }): JSX.Element {
  return (
    <span className={`block truncate ${className}`} title={email}>
      {email}
    </span>
  );
}

function NameLink({ item }: { item: StudentListItem }): JSX.Element {
  return (
    <Link to={`/admin/santri/${encodeURIComponent(item.id)}`} className="text-body font-semibold text-brand-primary hover:underline">
      {item.name}
    </Link>
  );
}

// Daftar Santri (SDD 7.7.17, UI-ADMIN-STUDENT-01/02). Pencarian, filter, urutan, dan halaman disimpan
// di URL query dan dikerjakan backend (SDD 3.16.4). [REKOMENDASI] Tidak ada desain Figma untuk admin.
export function StudentListPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const query = parseStudentQuery(params);
  const students = useStudents(query);
  const statusChange = useStatusChange();

  const update = useCallback(
    (patch: Partial<StudentQuery>, options: { replace?: boolean } = {}) => {
      setParams((current) => toSearchParams({ ...parseStudentQuery(current), ...patch, page: patch.page ?? 1 }), { replace: options.replace });
    },
    [setParams],
  );
  const reset = useCallback(() => {
    setParams((current) => {
      const { sort } = parseStudentQuery(current);
      return sort === DEFAULT_SORT ? new URLSearchParams() : new URLSearchParams({ sort });
    });
  }, [setParams]);
  const goToPage = (page: number) => {
    update({ page });
    window.scrollTo(0, 0);
  };

  const actionButton = (item: StudentListItem) => (
    <button
      type="button"
      onClick={(event) => statusChange.open({ id: item.id, name: item.name, status: item.status }, event.currentTarget)}
      aria-label={`${item.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'} akun ${item.name}`}
      className="min-h-11 whitespace-nowrap rounded-md px-3 text-body text-brand-primary hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
    >
      {item.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
    </button>
  );

  const columns: DataColumn<StudentListItem>[] = [
    { header: 'ID', render: (item) => item.studentCode, cellClassName: 'whitespace-nowrap text-body-s text-text-secondary' },
    { header: 'NAMA', render: (item) => <NameLink item={item} /> },
    { header: 'EMAIL', render: (item) => <EmailText email={item.email} className="max-w-[14rem]" />, cellClassName: 'text-body-s text-text-secondary' },
    { header: 'TAHAPAN', render: (item) => item.currentStage ?? '—', cellClassName: 'max-w-[14rem] text-body-s' },
    { header: 'PROGRESS', render: (item) => `${item.learningProgressPct}%`, cellClassName: 'text-body' },
    { header: 'NILAI', render: scoreText, cellClassName: 'text-h3' },
    { header: 'STATUS', render: (item) => <StatusPill status={item.status} /> },
    { header: 'AKSI', render: actionButton },
  ];

  const filtered = hasActiveFilters(query);

  let content: JSX.Element;
  if (students.isPending) {
    content = <ListSkeleton rows={5} />;
  } else if (students.isError) {
    content = <ErrorState error={students.error} onRetry={() => void students.refetch()} backTo="/admin" backLabel="Kembali ke dashboard" />;
  } else if (students.data.data.length === 0) {
    content = (
      <div className="flex flex-col items-start gap-4 rounded-md border-2 border-neutral-border bg-neutral-surface p-8">
        <p className="text-body text-text-secondary">{filtered ? 'Tidak ada santri yang cocok dengan pencarian atau filter.' : 'Belum ada santri terdaftar.'}</p>
        {filtered && (
          <Button variant="outline" onClick={reset}>
            HAPUS FILTER
          </Button>
        )}
      </div>
    );
  } else {
    const { data, meta } = students.data;
    content = (
      <div className="flex flex-col gap-6" aria-busy={students.isPlaceholderData || undefined}>
        <DataTable
          columns={columns}
          rows={data}
          rowKey={(item) => item.id}
          caption="Daftar santri"
          compact
          renderCard={(item) => (
            <div className="flex flex-col gap-3 rounded-md border border-neutral-border bg-neutral-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <NameLink item={item} />
                  <p className="text-body-s text-text-secondary">{item.studentCode}</p>
                  <EmailText email={item.email} className="text-body-s text-text-secondary" />
                </div>
                <StatusPill status={item.status} />
              </div>
              <dl className="grid grid-cols-3 gap-3 text-body-s">
                <div className="col-span-3">
                  <dt className="text-text-muted">Tahapan</dt>
                  <dd className="text-text-primary">{item.currentStage ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Progress</dt>
                  <dd className="text-h3 text-text-primary">{item.learningProgressPct}%</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Nilai</dt>
                  <dd className="text-h3 text-text-primary">{scoreText(item)}</dd>
                </div>
              </dl>
              <div className="-mx-3">{actionButton(item)}</div>
            </div>
          )}
        />
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onChange={goToPage} label="Halaman daftar santri" />}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1364px] flex-col gap-6">
      <h1 className="sr-only">Daftar Santri</h1>
      <StudentFilters query={query} onChange={update} onReset={reset} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-body-s text-text-secondary" aria-live="polite">
          {students.data?.meta ? `${students.data.meta.total} santri ditemukan` : ''}
        </p>
        <div className="w-full sm:w-72">
          <SelectField label="Urutkan" value={query.sort} onChange={(sort) => update({ sort })}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      {statusChange.notice && (
        <p className="rounded-md bg-feedback-benar-soft px-5 py-3 text-body-s text-feedback-benar" role="status">
          {statusChange.notice}
        </p>
      )}
      {content}
      {statusChange.dialog}
    </div>
  );
}
