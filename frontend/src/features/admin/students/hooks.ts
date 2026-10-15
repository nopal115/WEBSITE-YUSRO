import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminDashboardKeys } from '../dashboard/hooks';
import { adminStudentsApi } from './api';
import { toApiParams, type StudentQuery } from './query';
import type { StudentStatusInput } from './types';

// Semua key diawali ['admin', 'students'] agar daftar dan detail diinvalidasi bersama.
export const adminStudentKeys = {
  all: ['admin', 'students'] as const,
  list: (params: string) => ['admin', 'students', 'list', params] as const,
  detail: (id: string) => ['admin', 'students', 'detail', id] as const,
  statistics: (id: string) => ['admin', 'students', 'detail', id, 'statistics'] as const,
  chart: (id: string) => ['admin', 'students', 'detail', id, 'chart'] as const,
  history: (id: string, page: number) => ['admin', 'students', 'detail', id, 'history', page] as const,
  stages: ['admin', 'stages'] as const,
};

export function useStudents(query: StudentQuery) {
  const params = toApiParams(query);
  return useQuery({
    queryKey: adminStudentKeys.list(params.toString()),
    queryFn: ({ signal }) => adminStudentsApi.list(params, signal),
    // Pindah halaman/filter tanpa tabel berkedip.
    placeholderData: keepPreviousData,
  });
}

export function useStages() {
  return useQuery({ queryKey: adminStudentKeys.stages, queryFn: ({ signal }) => adminStudentsApi.getStages(signal), staleTime: 5 * 60 * 1000 });
}

export function useStudent(id: string) {
  return useQuery({ queryKey: adminStudentKeys.detail(id), queryFn: ({ signal }) => adminStudentsApi.get(id, signal) });
}

export function useStudentStatistics(id: string) {
  return useQuery({ queryKey: adminStudentKeys.statistics(id), queryFn: ({ signal }) => adminStudentsApi.getStatistics(id, signal) });
}

export function useStudentChart(id: string) {
  return useQuery({ queryKey: adminStudentKeys.chart(id), queryFn: ({ signal }) => adminStudentsApi.getChart(id, signal) });
}

export function useStudentHistory(id: string, page: number) {
  return useQuery({
    queryKey: adminStudentKeys.history(id, page),
    queryFn: ({ signal }) => adminStudentsApi.getHistory(id, page, signal),
    placeholderData: keepPreviousData,
  });
}

/** Setelah berhasil: daftar, detail, dan dashboard admin dimuat ulang (keputusan A2 butir 3). */
export function useUpdateStudentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StudentStatusInput }) => adminStudentsApi.updateStatus(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.all, refetchType: 'all' });
      void queryClient.invalidateQueries({ queryKey: adminDashboardKeys.summary, refetchType: 'all' });
    },
  });
}
