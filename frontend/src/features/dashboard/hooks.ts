import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from './api';

/** Key ['dashboard'] ikut diinvalidasi saat materi diselesaikan (features/learning/hooks). */
export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: ({ signal }) => dashboardApi.get(signal) });
}
