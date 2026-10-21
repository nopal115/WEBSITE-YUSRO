import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAudioApi } from './api';
import type { AudioKind } from './types';

export const adminAudioKeys = {
  all: ['admin', 'audio'] as const,
  list: (kind?: string) => ['admin', 'audio', 'list', kind ?? 'ALL'] as const,
};

export function useAdminAudioList(kind?: string) {
  return useQuery({
    queryKey: adminAudioKeys.list(kind),
    queryFn: ({ signal }) => adminAudioApi.list(kind, signal),
  });
}

export function useAudioMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: adminAudioKeys.all });

  return {
    upload: useMutation({
      mutationFn: ({ file, kind }: { file: File; kind: AudioKind }) =>
        adminAudioApi.upload(file, kind),
      onSettled: invalidate,
    }),
    archive: useMutation({
      mutationFn: (id: string) => adminAudioApi.archive(id),
      onSettled: invalidate,
    }),
    replace: useMutation({
      mutationFn: ({ id, file }: { id: string; file: File }) =>
        adminAudioApi.replace(id, file),
      onSettled: invalidate,
    }),
  };
}
