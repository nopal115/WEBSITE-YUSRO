import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { SelectField } from '../../../components/ui/SelectField';
import { TextField } from '../../../components/ui/TextField';
import type { EvaluationStatus } from '../../../lib/api/types';
import { useDraft } from '../../../lib/hooks/useDraft';
import { useStudent } from '../students/hooks';
import { useImitationTasks } from './hooks';
import { hasMonitoringFilters, STATUS_OPTIONS, validateDateRange, type MonitoringQuery } from './query';

/** Filter santri hanya dari URL (?studentId=, tautan "Lihat rekaman"), tampil sebagai chip yang bisa dihapus. */
function StudentChip({ studentId, onRemove }: { studentId: string; onRemove: () => void }): JSX.Element {
  const student = useStudent(studentId);
  const name = student.isPending ? 'Memuat…' : student.isError ? 'Santri tidak ditemukan' : student.data.name;
  return (
    <span className="inline-flex items-center gap-1 self-start rounded-full border border-brand-primary-line bg-brand-primary-soft py-1 pl-4 pr-1 text-body-s text-brand-primary">
      Santri: {name}
      <button type="button" onClick={onRemove} aria-label="Hapus filter santri" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-neutral-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary">
        <X size={18} aria-hidden="true" />
      </button>
    </span>
  );
}

interface MonitoringFiltersProps {
  query: MonitoringQuery;
  onChange: (patch: Partial<MonitoringQuery>) => void;
  onReset: () => void;
}

const desktopOpen = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

/** Filter status, tugas, dan rentang tanggal (SDD 5.18); penyaringan dikerjakan backend. */
export function MonitoringFilters({ query, onChange, onReset }: MonitoringFiltersProps): JSX.Element {
  const tasks = useImitationTasks();
  const [open] = useState(desktopOpen);
  const [from, setFrom] = useDraft(query.from);
  const [to, setTo] = useDraft(query.to);
  const rangeError = validateDateRange(from, to);

  // Tanggal diterapkan begitu isian lengkap dan rentangnya valid.
  useEffect(() => {
    if (rangeError || (from === query.from && to === query.to)) return;
    onChange({ from, to });
  }, [from, to, rangeError, query.from, query.to, onChange]);

  const activeCount = [query.status, query.taskId, query.from || query.to].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      {query.studentId && <StudentChip studentId={query.studentId} onRemove={() => onChange({ studentId: '' })} />}
      <details open={open} className="rounded-md border border-neutral-border bg-neutral-surface">
        <summary className="flex min-h-11 cursor-pointer items-center px-5 text-body font-semibold text-text-primary">Filter{activeCount > 0 ? ` (${activeCount} aktif)` : ''}</summary>
        <div className="grid grid-cols-1 gap-5 border-t border-neutral-border p-5 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField label="Status evaluasi" value={query.status} onChange={(status) => onChange({ status: status as EvaluationStatus | '' })}>
            <option value="">Semua status</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Tugas" value={query.taskId} onChange={(taskId) => onChange({ taskId })}>
            <option value="">Semua tugas Dengar-Tirukan</option>
            {tasks.data?.map((task) => (
              <option key={task.id} value={task.id}>
                {task.materialTitle} — {task.title}
              </option>
            ))}
          </SelectField>
          <TextField type="date" label="Dari tanggal" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          <TextField type="date" label="Sampai tanggal" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} error={rangeError ?? undefined} />
          {tasks.isError && <p className="text-body-s text-text-secondary sm:col-span-2 xl:col-span-4">Daftar tugas gagal dimuat; filter tugas belum tersedia.</p>}
          {hasMonitoringFilters(query) && (
            <div className="sm:col-span-2 xl:col-span-4">
              <Button variant="outline" onClick={onReset}>
                HAPUS FILTER
              </Button>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
