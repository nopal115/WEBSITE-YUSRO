import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { SelectField } from '../../../components/ui/SelectField';
import { TextField } from '../../../components/ui/TextField';
import { useDraft } from '../../../lib/hooks/useDraft';
import type { AccountStatus } from '../../auth/types';
import { useStages } from './hooks';
import { hasActiveFilters, parsePercent, validateRange, type StudentQuery } from './query';

const SEARCH_DELAY_MS = 300;
const RANGE_DELAY_MS = 400;

const asText = (value: number | null) => (value === null ? '' : String(value));

/** Dua isian rentang (min–maks, 0–100) yang diterapkan setelah jeda ketik bila valid. */
function RangeFields({ label, min, max, onApply }: { label: string; min: number | null; max: number | null; onApply: (min: number | null, max: number | null) => void }): JSX.Element {
  const [minText, setMinText] = useDraft(asText(min));
  const [maxText, setMaxText] = useDraft(asText(max));
  const errors = validateRange(minText, maxText);
  const valid = !errors.min && !errors.max;

  useEffect(() => {
    if (!valid) return;
    const nextMin = parsePercent(minText);
    const nextMax = parsePercent(maxText);
    if (nextMin === min && nextMax === max) return;
    const timer = window.setTimeout(() => onApply(nextMin, nextMax), RANGE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [minText, maxText, valid, min, max, onApply]);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-body-s font-semibold text-text-primary">{label} (0–100)</legend>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Min" inputMode="decimal" value={minText} onChange={(event) => setMinText(event.target.value)} error={errors.min} />
        <TextField label="Maks" inputMode="decimal" value={maxText} onChange={(event) => setMaxText(event.target.value)} error={errors.max} />
      </div>
    </fieldset>
  );
}

interface StudentFiltersProps {
  query: StudentQuery;
  /** replace: true untuk pencarian ketik, supaya tiap huruf tidak menjadi entri riwayat browser. */
  onChange: (patch: Partial<StudentQuery>, options?: { replace?: boolean }) => void;
  onReset: () => void;
}

const desktopOpen = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

/** Pencarian tunggal dan penyaring daftar Santri (SDD 7.7.17, FR-STUDENT-03/04). */
export function StudentFilters({ query, onChange, onReset }: StudentFiltersProps): JSX.Element {
  const stages = useStages();
  const [search, setSearch] = useDraft(query.q);
  const [open] = useState(desktopOpen);

  useEffect(() => {
    const next = search.trim();
    if (next === query.q) return;
    const timer = window.setTimeout(() => onChange({ q: next }, { replace: true }), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search, query.q, onChange]);

  const applyProgress = useCallback((min: number | null, max: number | null) => onChange({ progressMin: min, progressMax: max }), [onChange]);
  const applyScore = useCallback((min: number | null, max: number | null) => onChange({ scoreMin: min, scoreMax: max }), [onChange]);
  const activeCount = [query.stageId, query.status, query.progressMin !== null || query.progressMax !== null, query.scoreMin !== null || query.scoreMax !== null].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      <TextField type="search" label="Cari nama, email, atau ID Santri" value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" />
      {/* Layar sempit: panel lipat; desktop: terbuka sejak awal. */}
      <details open={open} className="rounded-md border border-neutral-border bg-neutral-surface">
        <summary className="flex min-h-11 cursor-pointer items-center px-5 text-body font-semibold text-text-primary">Filter{activeCount > 0 ? ` (${activeCount} aktif)` : ''}</summary>
        <div className="grid grid-cols-1 gap-5 border-t border-neutral-border p-5 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField label="Tahapan" value={query.stageId} onChange={(stageId) => onChange({ stageId })}>
            <option value="">Semua tahapan</option>
            {stages.data?.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.title}
              </option>
            ))}
          </SelectField>
          <SelectField label="Status akun" value={query.status} onChange={(status) => onChange({ status: status as AccountStatus | '' })}>
            <option value="">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </SelectField>
          <RangeFields label="Progress (%)" min={query.progressMin} max={query.progressMax} onApply={applyProgress} />
          <RangeFields label="Nilai rata-rata" min={query.scoreMin} max={query.scoreMax} onApply={applyScore} />
          {stages.isError && <p className="text-body-s text-text-secondary sm:col-span-2 xl:col-span-4">Daftar tahapan gagal dimuat; filter tahapan belum tersedia.</p>}
          {hasActiveFilters(query) && (
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
