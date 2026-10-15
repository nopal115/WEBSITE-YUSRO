import { apiRequest, apiRequestWithMeta } from '../../lib/api/client';
import { withPage, type PageParams, type Paginated } from '../../lib/api/types';
import type { HistoryItem, Progress } from './types';

// SDD 5.11.
export const progressApi = {
  get: (signal?: AbortSignal): Promise<Progress> => apiRequest<Progress>('progress', { signal }),

  getHistory: (params?: PageParams, signal?: AbortSignal): Promise<Paginated<HistoryItem>> =>
    apiRequestWithMeta<HistoryItem[]>(withPage('progress/history', params), { signal }),
};
