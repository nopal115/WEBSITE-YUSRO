import { apiRequest, apiRequestBlob, apiRequestWithMeta, type BlobResult } from '../../../lib/api/client';
import { withPage, type Paginated } from '../../../lib/api/types';
import type { HistoryItem } from '../../progress/types';
import type { Statistics, StatisticsChart } from '../../statistics/types';
import type { StageOption, StudentDetail, StudentListItem, StudentStatusInput } from './types';

const base = (id: string) => `admin/students/${encodeURIComponent(id)}`;

// SDD 5.14 (+ riwayat [ASUMSI]) dan GET /admin/stages (SDD 5.15).
export const adminStudentsApi = {
  /** Pencarian, filter, urutan, dan pagination dikerjakan backend (SDD 3.16.4). */
  list: (params: URLSearchParams, signal?: AbortSignal): Promise<Paginated<StudentListItem>> =>
    apiRequestWithMeta<StudentListItem[]>(`admin/students?${params.toString()}`, { signal }),

  get: (id: string, signal?: AbortSignal): Promise<StudentDetail> => apiRequest<StudentDetail>(base(id), { signal }),

  updateStatus: (id: string, input: StudentStatusInput): Promise<unknown> => apiRequest<unknown>(`${base(id)}/status`, { method: 'PATCH', body: input }),

  /** [ASUMSI] Bentuk sama dengan GET /statistics sisi Santri. */
  getStatistics: (id: string, signal?: AbortSignal): Promise<Statistics> => apiRequest<Statistics>(`${base(id)}/statistics`, { signal }),

  /** [ASUMSI] Bentuk sama dengan GET /statistics/chart sisi Santri. */
  getChart: (id: string, signal?: AbortSignal): Promise<StatisticsChart> => apiRequest<StatisticsChart>(`${base(id)}/chart`, { signal }),

  /** [ASUMSI] Endpoint baru, bentuk sama dengan GET /progress/history (termasuk meta). */
  getHistory: (id: string, page: number, signal?: AbortSignal): Promise<Paginated<HistoryItem>> =>
    apiRequestWithMeta<HistoryItem[]>(withPage(`${base(id)}/history`, { page }), { signal }),

  downloadReport: (id: string): Promise<BlobResult> => apiRequestBlob(`${base(id)}/report/pdf`),

  getStages: (signal?: AbortSignal): Promise<StageOption[]> => apiRequest<StageOption[]>('admin/stages', { signal }),
};
