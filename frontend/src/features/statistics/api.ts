import { apiRequest } from '../../lib/api/client';
import type { Statistics, StatisticsChart } from './types';

// SDD 5.12.
export const statisticsApi = {
  get: (signal?: AbortSignal): Promise<Statistics> => apiRequest<Statistics>('statistics', { signal }),

  getChart: (signal?: AbortSignal): Promise<StatisticsChart> => apiRequest<StatisticsChart>('statistics/chart', { signal }),
};
