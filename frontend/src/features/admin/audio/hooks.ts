import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminContentKeys } from '../content/hooks';
import { adminAudioApi } from './api';
import type { AudioFilter, AudioKind } from './types';

export const adminAudioKeys = {
  all: ['admin', 'audio'] as const,
  list: (filter: AudioFilter) => ['admin', 'audio', 'list', filter] as const,
  detail: (id: string) => ['admin', 'audio', 'detail', id] as const,
};

export function useAdminAudioList(filter: AudioFilter) {
  return useQuery({ queryKey: adminAudioKeys.list(filter), queryFn: ({ signal }) => adminAudioApi.list(filter, signal) });
}

export function useAdminAudioDetail(id: string) {
  return useQuery({ queryKey: adminAudioKeys.detail(id), queryFn: ({ signal }) => adminAudioApi.get(id, signal) });
}

/** Setelah perubahan: daftar audio dan pilihan audio di penyunting materi (A4) dimuat ulang. */
export function useAudioMutations() {
  const queryClient = useQueryClient();
  const options = {
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminAudioKeys.all });
      void queryClient.invalidateQueries({ queryKey: adminContentKeys.audio });
    },
  };
  return {
    upload: useMutation({ mutationFn: ({ file, kind }: { file: File; kind: AudioKind }) => adminAudioApi.upload(file, kind), ...options }),
    replace: useMutation({ mutationFn: ({ id, file }: { id: string; file: File }) => adminAudioApi.replace(id, file), ...options }),
    archive: useMutation({ mutationFn: (id: string) => adminAudioApi.archive(id), ...options }),
  };
}
