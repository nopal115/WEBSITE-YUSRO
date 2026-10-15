import { apiRequest } from '../../lib/api/client';
import type { DashboardData } from './types';

export const dashboardApi = {
  get: (signal?: AbortSignal): Promise<DashboardData> => apiRequest<DashboardData>('dashboard', { signal }),
};
