import type { EvaluationStatus } from '../../../lib/api/types';

/** Keadaan daftar submission yang disimpan di URL query (parameter SDD 5.18). */
export interface MonitoringQuery {
  status: EvaluationStatus | '';
  taskId: string;
  /** Hanya dari tautan "Lihat rekaman" di Detail Santri; tampil sebagai chip. */
  studentId: string;
  /** [ASUMSI] Tanggal YYYY-MM-DD, inklusif per hari. */
  from: string;
  to: string;
  page: number;
}

export const STATUS_OPTIONS: { value: EvaluationStatus; label: string }[] = [
  { value: 'SUBMITTED', label: 'Dalam antrean' },
  { value: 'PROCESSING', label: 'Sedang diproses' },
  { value: 'EVALUATED', label: 'Selesai' },
  { value: 'FAILED', label: 'Gagal diproses' },
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: string | null): value is string => value !== null && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));

/** Nilai URL yang tidak valid diabaikan; rentang terbalik membuang tanggal akhir. */
export function parseMonitoringQuery(params: URLSearchParams): MonitoringQuery {
  const status = params.get('status');
  const from = isDate(params.get('from')) ? (params.get('from') as string) : '';
  const rawTo = isDate(params.get('to')) ? (params.get('to') as string) : '';
  return {
    status: STATUS_OPTIONS.some((option) => option.value === status) ? (status as EvaluationStatus) : '',
    taskId: params.get('taskId') ?? '',
    studentId: params.get('studentId') ?? '',
    from,
    to: from && rawTo && rawTo < from ? '' : rawTo,
    page: Math.max(1, Math.floor(Number(params.get('page'))) || 1),
  };
}

/** Query URL; halaman 1 dan filter kosong tidak ditulis. */
export function toMonitoringParams(query: MonitoringQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.taskId) params.set('taskId', query.taskId);
  if (query.studentId) params.set('studentId', query.studentId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.page > 1) params.set('page', String(query.page));
  return params;
}

/** Parameter request GET /admin/submissions (selalu menyertakan page). */
export function toSubmissionApiParams(query: MonitoringQuery): URLSearchParams {
  const params = toMonitoringParams(query);
  params.set('page', String(query.page));
  return params;
}

export function hasMonitoringFilters(query: MonitoringQuery): boolean {
  return Boolean(query.status || query.taskId || query.studentId || query.from || query.to);
}

/** Validasi rentang tanggal isian: tanggal akhir tidak boleh lebih awal dari tanggal awal. */
export function validateDateRange(from: string, to: string): string | null {
  if (from && to && to < from) return 'Tanggal akhir tidak boleh lebih awal dari tanggal awal.';
  return null;
}
