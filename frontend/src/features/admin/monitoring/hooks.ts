import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '../../../lib/api/types';
import { adminDashboardKeys } from '../dashboard/hooks';
import { adminStudentKeys } from '../students/hooks';
import { adminMonitoringApi } from './api';
import { toSubmissionApiParams, type MonitoringQuery } from './query';
import type { AdminSubmission } from './types';

export const adminMonitoringKeys = {
  all: ['admin', 'monitoring'] as const,
  submissions: ['admin', 'monitoring', 'submissions'] as const,
  list: (params: string) => ['admin', 'monitoring', 'submissions', params] as const,
  queue: ['admin', 'monitoring', 'queue'] as const,
  health: ['admin', 'monitoring', 'health'] as const,
  tasks: ['admin', 'tasks', 'IMITATION'] as const,
};

// Tanpa polling (keputusan A3): data dimuat ulang lewat tombol MUAT ULANG dan saat tab kembali aktif.
export function useSubmissions(query: MonitoringQuery) {
  const params = toSubmissionApiParams(query);
  return useQuery({
    queryKey: adminMonitoringKeys.list(params.toString()),
    queryFn: ({ signal }) => adminMonitoringApi.listSubmissions(params, signal),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

export function useEvaluationQueue() {
  return useQuery({ queryKey: adminMonitoringKeys.queue, queryFn: ({ signal }) => adminMonitoringApi.getQueue(signal), refetchOnWindowFocus: true });
}

export function useServiceHealth() {
  return useQuery({ queryKey: adminMonitoringKeys.health, queryFn: ({ signal }) => adminMonitoringApi.getHealth(signal), refetchOnWindowFocus: true });
}

export function useImitationTasks() {
  return useQuery({ queryKey: adminMonitoringKeys.tasks, queryFn: ({ signal }) => adminMonitoringApi.getTasks('IMITATION', signal), staleTime: 5 * 60 * 1000 });
}

/**
 * Proses Ulang (SDD 7.7.20): setelah 202, baris di cache langsung menjadi SUBMITTED; antrean, dashboard,
 * dan data santri dimuat ulang. Nomor percobaan tidak berubah (BR-ML-07).
 */
export function useRetrySubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (submission: AdminSubmission) => adminMonitoringApi.retry(submission.submissionId),
    onSuccess: (result) => {
      queryClient.setQueriesData<Paginated<AdminSubmission>>({ queryKey: adminMonitoringKeys.submissions }, (current) =>
        current
          ? {
              ...current,
              data: current.data.map((item) =>
                item.submissionId === result.submissionId ? { ...item, evaluationStatus: result.evaluationStatus, score: null, feedbackCategory: null, evaluatedAt: null, failedAt: null } : item,
              ),
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: adminMonitoringKeys.queue });
      void queryClient.invalidateQueries({ queryKey: adminDashboardKeys.summary, refetchType: 'all' });
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.all, refetchType: 'all' });
    },
  });
}
