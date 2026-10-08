import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { statisticsApi } from '../statistics/api';
import { progressApi } from './api';

// Key diawali ['progress'] agar ikut diinvalidasi setelah materi/tugas selesai.
export function useProgress() {
  return useQuery({ queryKey: ['progress'], queryFn: ({ signal }) => progressApi.get(signal) });
}

export function useHistory(page: number) {
  return useQuery({
    queryKey: ['progress', 'history', page],
    queryFn: ({ signal }) => progressApi.getHistory({ page }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useStatistics() {
  return useQuery({ queryKey: ['progress', 'statistics'], queryFn: ({ signal }) => statisticsApi.get(signal) });
}

export function useStatisticsChart() {
  return useQuery({ queryKey: ['progress', 'statistics', 'chart'], queryFn: ({ signal }) => statisticsApi.getChart(signal) });
}
