import type { AccountStatus } from '../../auth/types';

/** Keadaan daftar Santri yang disimpan di URL query (SDD 5.14 parameter daftar). */
export interface StudentQuery {
  q: string;
  stageId: string;
  progressMin: number | null;
  progressMax: number | null;
  scoreMin: number | null;
  scoreMax: number | null;
  status: AccountStatus | '';
  sort: string;
  page: number;
}

export const DEFAULT_SORT = 'name:asc';

export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'name:asc', label: 'Nama (A–Z)' },
  { value: 'name:desc', label: 'Nama (Z–A)' },
  { value: 'progress:desc', label: 'Progress tertinggi' },
  { value: 'progress:asc', label: 'Progress terendah' },
  { value: 'averageScore:desc', label: 'Nilai tertinggi' },
  { value: 'averageScore:asc', label: 'Nilai terendah' },
  { value: 'lastActivity:desc', label: 'Aktivitas terbaru' },
  { value: 'lastActivity:asc', label: 'Aktivitas terlama' },
];

const RANGE_KEYS = ['progressMin', 'progressMax', 'scoreMin', 'scoreMax'] as const;
type RangeKey = (typeof RANGE_KEYS)[number];

/** Angka 0–100 dari teks; null bila kosong atau tidak valid. */
export function parsePercent(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

/** Nilai URL yang tidak valid diabaikan, sehingga tautan rusak tetap menampilkan daftar. */
export function parseStudentQuery(params: URLSearchParams): StudentQuery {
  const status = params.get('status');
  const sort = params.get('sort') ?? DEFAULT_SORT;
  const range = Object.fromEntries(RANGE_KEYS.map((key) => [key, parsePercent(params.get(key))])) as Record<RangeKey, number | null>;
  return {
    q: params.get('q')?.trim() ?? '',
    stageId: params.get('stageId') ?? '',
    ...range,
    status: status === 'ACTIVE' || status === 'INACTIVE' ? status : '',
    sort: SORT_OPTIONS.some((option) => option.value === sort) ? sort : DEFAULT_SORT,
    page: Math.max(1, Math.floor(Number(params.get('page'))) || 1),
  };
}

/** Query URL; nilai bawaan (urutan nama, halaman 1, filter kosong) tidak ditulis. */
export function toSearchParams(query: StudentQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.stageId) params.set('stageId', query.stageId);
  for (const key of RANGE_KEYS) if (query[key] !== null) params.set(key, String(query[key]));
  if (query.status) params.set('status', query.status);
  if (query.sort !== DEFAULT_SORT) params.set('sort', query.sort);
  if (query.page > 1) params.set('page', String(query.page));
  return params;
}

/** Parameter request GET /admin/students (selalu menyertakan sort dan page). */
export function toApiParams(query: StudentQuery): URLSearchParams {
  const params = toSearchParams(query);
  params.set('sort', query.sort);
  params.set('page', String(query.page));
  return params;
}

export function hasActiveFilters(query: StudentQuery): boolean {
  return Boolean(query.q || query.stageId || query.status || RANGE_KEYS.some((key) => query[key] !== null));
}

/** Validasi isian rentang (teks): angka 0–100 dan min ≤ maks. Mengembalikan pesan galat per sisi. */
export function validateRange(minText: string, maxText: string): { min?: string; max?: string } {
  const errors: { min?: string; max?: string } = {};
  const min = parsePercent(minText);
  const max = parsePercent(maxText);
  if (minText.trim() !== '' && min === null) errors.min = 'Isi angka 0–100.';
  if (maxText.trim() !== '' && max === null) errors.max = 'Isi angka 0–100.';
  if (!errors.min && !errors.max && min !== null && max !== null && min > max) errors.max = 'Maksimum tidak boleh lebih kecil dari minimum.';
  return errors;
}
