import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAudioKeys } from '../audio/hooks';
import { adminContentKeys } from '../content/hooks';
import { adminTaskApi } from './api';
import type { QuestionInput, TaskCreateInput, TaskUpdateInput } from './types';

export const adminTaskKeys = {
  all: ['admin', 'tasks'] as const,
  list: (materialId: string) => ['admin', 'tasks', 'list', materialId] as const,
  detail: (id: string) => ['admin', 'tasks', 'detail', id] as const,
  questions: (id: string) => ['admin', 'tasks', 'questions', id] as const,
};

export function useAdminTasks(materialId: string) {
  return useQuery({ queryKey: adminTaskKeys.list(materialId), queryFn: ({ signal }) => adminTaskApi.list(materialId, signal), enabled: materialId !== '' });
}

export function useAdminTask(id: string) {
  return useQuery({ queryKey: adminTaskKeys.detail(id), queryFn: ({ signal }) => adminTaskApi.get(id, signal) });
}

export function useTaskQuestions(id: string, enabled: boolean) {
  return useQuery({ queryKey: adminTaskKeys.questions(id), queryFn: ({ signal }) => adminTaskApi.getQuestions(id, signal), enabled });
}

/** Setelah perubahan: tugas (termasuk filter Monitoring A3), jumlah tugas per materi (A4), dan pemakaian audio (A5) dimuat ulang. */
function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: adminTaskKeys.all });
    void queryClient.invalidateQueries({ queryKey: adminContentKeys.all });
    void queryClient.invalidateQueries({ queryKey: adminAudioKeys.all });
  };
}

export function useTaskMutations() {
  const invalidate = useInvalidateTasks();
  const queryClient = useQueryClient();
  const options = { onSettled: invalidate };
  return {
    create: useMutation({ mutationFn: (input: TaskCreateInput) => adminTaskApi.create(input), ...options }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: TaskUpdateInput }) => adminTaskApi.update(id, input), ...options }),
    publish: useMutation({ mutationFn: (id: string) => adminTaskApi.publish(id), ...options }),
    remove: useMutation({ mutationFn: (id: string) => adminTaskApi.remove(id), ...options }),
    // Urutan baru langsung dipasang di cache agar daftar tidak sempat kembali ke urutan lama.
    reorder: useMutation({
      mutationFn: (orderedIds: string[]) => adminTaskApi.reorder(orderedIds),
      onSuccess: (tasks) => {
        if (tasks[0]) queryClient.setQueryData(adminTaskKeys.list(tasks[0].materialId), tasks);
      },
      ...options,
    }),
  };
}

export function useQuestionMutations(taskId: string) {
  const invalidate = useInvalidateTasks();
  const options = { onSettled: invalidate };
  return {
    create: useMutation({ mutationFn: (input: QuestionInput) => adminTaskApi.createQuestion(taskId, input), ...options }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: QuestionInput }) => adminTaskApi.updateQuestion(id, input), ...options }),
    remove: useMutation({ mutationFn: (id: string) => adminTaskApi.removeQuestion(id), ...options }),
  };
}
