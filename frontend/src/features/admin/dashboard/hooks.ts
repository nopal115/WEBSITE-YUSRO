import { useQuery } from '@tanstack/react-query';
import { adminDashboardApi } from './api';

export const adminDashboardKeys = {
  summary: ['admin', 'dashboard'] as const,
  attention: ['admin', 'dashboard', 'attention'] as const,
};

export function useAdminDashboard() {
  return useQuery({ queryKey: adminDashboardKeys.summary, queryFn: ({ signal }) => adminDashboardApi.get(signal) });
}

export function useAdminAttention() {
  return useQuery({ queryKey: adminDashboardKeys.attention, queryFn: ({ signal }) => adminDashboardApi.getAttention(signal) });
}
