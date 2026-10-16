import { apiRequest } from '../../../lib/api/client';
import type { AdminQuestion, AdminTask, AdminTaskDetail, QuestionInput, TaskCreateInput, TaskUpdateInput } from './types';

const task = (id: string) => `admin/tasks/${encodeURIComponent(id)}`;
const question = (id: string) => `admin/questions/${encodeURIComponent(id)}`;

// SDD 5.17.
export const adminTaskApi = {
  list: (materialId: string, signal?: AbortSignal): Promise<AdminTask[]> => apiRequest<AdminTask[]>(`admin/tasks?materialId=${encodeURIComponent(materialId)}`, { signal }),
  get: (id: string, signal?: AbortSignal): Promise<AdminTaskDetail> => apiRequest<AdminTaskDetail>(task(id), { signal }),
  create: (input: TaskCreateInput): Promise<AdminTaskDetail> => apiRequest<AdminTaskDetail>('admin/tasks', { method: 'POST', body: input }),
  update: (id: string, input: TaskUpdateInput): Promise<AdminTaskDetail> => apiRequest<AdminTaskDetail>(task(id), { method: 'PATCH', body: input }),
  remove: (id: string): Promise<unknown> => apiRequest<unknown>(task(id), { method: 'DELETE' }),
  /** Komponen belum lengkap → 422 TASK_INCOMPLETE dengan errors[] (SDD 3.7.3). */
  publish: (id: string): Promise<AdminTaskDetail> => apiRequest<AdminTaskDetail>(`${task(id)}/publish`, { method: 'POST' }),
  /** [ASUMSI] Seluruh tugas satu materi dalam urutan baru. */
  reorder: (orderedIds: string[]): Promise<AdminTask[]> => apiRequest<AdminTask[]>('admin/tasks/reorder', { method: 'PATCH', body: { orderedIds } }),

  getQuestions: (taskId: string, signal?: AbortSignal): Promise<AdminQuestion[]> => apiRequest<AdminQuestion[]>(`${task(taskId)}/questions`, { signal }),
  createQuestion: (taskId: string, input: QuestionInput): Promise<AdminQuestion> => apiRequest<AdminQuestion>(`${task(taskId)}/questions`, { method: 'POST', body: input }),
  updateQuestion: (id: string, input: QuestionInput): Promise<AdminQuestion> => apiRequest<AdminQuestion>(question(id), { method: 'PATCH', body: input }),
  removeQuestion: (id: string): Promise<unknown> => apiRequest<unknown>(question(id), { method: 'DELETE' }),
};
