import { apiRequest } from '../../../lib/api/client';
import type { AdminTaskDetail, AdminTaskListItem, QuestionInput, QuestionItem, TaskInput } from './types';

const base = (id: string) => `admin/tasks/${encodeURIComponent(id)}`;

export const adminTasksApi = {
  list: (type?: string, signal?: AbortSignal): Promise<AdminTaskListItem[]> => {
    const query = type && type !== 'ALL' ? `?type=${encodeURIComponent(type)}` : '';
    return apiRequest<AdminTaskListItem[]>(`admin/tasks${query}`, { signal });
  },

  get: (id: string, signal?: AbortSignal): Promise<AdminTaskDetail> =>
    apiRequest<AdminTaskDetail>(base(id), { signal }),

  create: (input: TaskInput): Promise<AdminTaskDetail> =>
    apiRequest<AdminTaskDetail>('admin/tasks', { method: 'POST', body: input }),

  update: (id: string, input: Partial<TaskInput>): Promise<AdminTaskDetail> =>
    apiRequest<AdminTaskDetail>(base(id), { method: 'PATCH', body: input }),

  delete: (id: string): Promise<unknown> =>
    apiRequest<unknown>(base(id), { method: 'DELETE' }),

  publish: (id: string): Promise<unknown> =>
    apiRequest<unknown>(`${base(id)}/publish`, { method: 'POST' }),

  addQuestion: (taskId: string, input: QuestionInput): Promise<QuestionItem> =>
    apiRequest<QuestionItem>(`${base(taskId)}/questions`, { method: 'POST', body: input }),

  updateQuestion: (questionId: string, input: Partial<QuestionInput>): Promise<QuestionItem> =>
    apiRequest<QuestionItem>(`admin/questions/${encodeURIComponent(questionId)}`, { method: 'PATCH', body: input }),

  deleteQuestion: (questionId: string): Promise<unknown> =>
    apiRequest<unknown>(`admin/questions/${encodeURIComponent(questionId)}`, { method: 'DELETE' }),
};
