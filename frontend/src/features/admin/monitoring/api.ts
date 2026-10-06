import { apiRequest, apiRequestWithMeta } from '../../../lib/api/client';
import type { Paginated, TaskType } from '../../../lib/api/types';
import type { AdminSubmission, AdminSubmissionDetail, EvaluationQueue, RecordingUrl, RetryResult, ServiceHealth, TaskOption } from './types';

const base = (id: string) => `admin/submissions/${encodeURIComponent(id)}`;

// SDD 5.18 (Monitoring) dan GET /admin/tasks minimal (SDD 5.17).
export const adminMonitoringApi = {
  /** Penyaringan dikerjakan backend (status, taskId, studentId, from, to, page, limit). */
  listSubmissions: (params: URLSearchParams, signal?: AbortSignal): Promise<Paginated<AdminSubmission>> =>
    apiRequestWithMeta<AdminSubmission[]>(`admin/submissions?${params.toString()}`, { signal }),

  getSubmission: (id: string, signal?: AbortSignal): Promise<AdminSubmissionDetail> => apiRequest<AdminSubmissionDetail>(base(id), { signal }),

  /** Diminta saat tombol putar ditekan; hasilnya tidak boleh disimpan di cache (NFR-PRIV-02, SDD 7.7.20). */
  getRecordingUrl: (id: string): Promise<RecordingUrl> => apiRequest<RecordingUrl>(`${base(id)}/recording-url`),

  retry: (id: string): Promise<RetryResult> => apiRequest<RetryResult>(`${base(id)}/retry`, { method: 'POST' }),

  getQueue: (signal?: AbortSignal): Promise<EvaluationQueue> => apiRequest<EvaluationQueue>('admin/evaluation/queue', { signal }),

  getHealth: (signal?: AbortSignal): Promise<ServiceHealth> => apiRequest<ServiceHealth>('admin/evaluation/health', { signal }),

  getTasks: (type: TaskType, signal?: AbortSignal): Promise<TaskOption[]> => apiRequest<TaskOption[]>(`admin/tasks?type=${type}`, { signal }),
};
