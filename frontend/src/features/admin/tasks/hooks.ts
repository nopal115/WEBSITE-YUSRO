import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminTasksApi } from './api';
import type { QuestionInput, TaskInput } from './types';

export const adminTaskKeys = {
  all: ['admin', 'tasks'] as const,
  list: (type?: string) => ['admin', 'tasks', 'list', type ?? 'ALL'] as const,
  detail: (id: string) => ['admin', 'tasks', 'detail', id] as const,
};

export function useAdminTasksList(type?: string) {
  return useQuery({
    queryKey: adminTaskKeys.list(type),
    queryFn: ({ signal }) => adminTasksApi.list(type, signal),
  });
}

export function useAdminTaskDetail(id: string) {
  return useQuery({
    queryKey: adminTaskKeys.detail(id),
    queryFn: ({ signal }) => adminTasksApi.get(id, signal),
    enabled: Boolean(id),
  });
}

export function useTaskMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: adminTaskKeys.all });

  return {
    create: useMutation({
      mutationFn: (input: TaskInput) => adminTasksApi.create(input),
      onSettled: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<TaskInput> }) =>
        adminTasksApi.update(id, input),
      onSettled: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => adminTasksApi.delete(id),
      onSettled: invalidate,
    }),
    publish: useMutation({
      mutationFn: (id: string) => adminTasksApi.publish(id),
      onSettled: invalidate,
    }),
    addQuestion: useMutation({
      mutationFn: ({ taskId, input }: { taskId: string; input: QuestionInput }) =>
        adminTasksApi.addQuestion(taskId, input),
      onSettled: invalidate,
    }),
    updateQuestion: useMutation({
      mutationFn: ({ questionId, input }: { questionId: string; input: Partial<QuestionInput> }) =>
        adminTasksApi.updateQuestion(questionId, input),
      onSettled: invalidate,
    }),
    deleteQuestion: useMutation({
      mutationFn: (questionId: string) => adminTasksApi.deleteQuestion(questionId),
      onSettled: invalidate,
    }),
  };
}
