import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learningKeys } from '../learning/hooks';
import { quizApi } from './api';
import type { SubmitQuizInput } from './types';

const quizTaskKey = (taskId: string) => ['quiz', 'task', taskId] as const;

export function useQuizTask(taskId: string) {
  return useQuery({ queryKey: quizTaskKey(taskId), queryFn: ({ signal }) => quizApi.getTask(taskId, signal) });
}

/** Setelah terkirim, data yang terdampak (status tugas, progress, dashboard) diinvalidasi. */
export function useSubmitQuiz(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitQuizInput) => quizApi.submit(taskId, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: learningKeys.all, refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: quizTaskKey(taskId) }),
      ]),
  });
}
