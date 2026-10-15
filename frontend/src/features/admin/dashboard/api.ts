import { apiRequest } from '../../../lib/api/client';
import type { AdminDashboard, AttentionItem } from './types';

// SDD 5.18.
export const adminDashboardApi = {
  get: (signal?: AbortSignal): Promise<AdminDashboard> => apiRequest<AdminDashboard>('admin/dashboard', { signal }),

  getAttention: (signal?: AbortSignal): Promise<AttentionItem[]> => apiRequest<AttentionItem[]>('admin/dashboard/attention', { signal }),
};
