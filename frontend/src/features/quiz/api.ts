import { apiRequest } from '../../lib/api/client';
import type { QuizAttempt, QuizSubmitResult, QuizTask, SubmitQuizInput } from './types';

// SDD 5.9.
export const quizApi = {
  getTask: (taskId: string, signal?: AbortSignal): Promise<QuizTask> =>
    apiRequest<QuizTask>(`quiz/tasks/${encodeURIComponent(taskId)}`, { signal }),

  submit: (taskId: string, input: SubmitQuizInput): Promise<QuizSubmitResult> =>
    apiRequest<QuizSubmitResult>(`quiz/tasks/${encodeURIComponent(taskId)}/submit`, { method: 'POST', body: input }),

  getAttempt: (attemptId: string, signal?: AbortSignal): Promise<QuizAttempt> =>
    apiRequest<QuizAttempt>(`quiz/attempts/${encodeURIComponent(attemptId)}`, { signal }),
};
