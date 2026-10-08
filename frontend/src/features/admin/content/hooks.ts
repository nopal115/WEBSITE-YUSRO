import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminStudentKeys } from '../students/hooks';
import { adminContentApi } from './api';
import type { BlockInput, MaterialInput, StageInput } from './types';

export const adminContentKeys = {
  all: ['admin', 'content'] as const,
  stages: ['admin', 'content', 'stages'] as const,
  materials: (stageId: string) => ['admin', 'content', 'materials', stageId] as const,
  material: (id: string) => ['admin', 'content', 'material', id] as const,
  blocks: (id: string) => ['admin', 'content', 'blocks', id] as const,
  audio: ['admin', 'content', 'audio'] as const,
};

export function useAdminStages() {
  return useQuery({ queryKey: adminContentKeys.stages, queryFn: ({ signal }) => adminContentApi.getStages(signal) });
}

export function useAdminMaterials(stageId: string) {
  return useQuery({ queryKey: adminContentKeys.materials(stageId), queryFn: ({ signal }) => adminContentApi.getMaterials(stageId, signal), enabled: stageId !== '' });
}

export function useAdminMaterial(id: string) {
  return useQuery({ queryKey: adminContentKeys.material(id), queryFn: ({ signal }) => adminContentApi.getMaterial(id, signal) });
}

export function useMaterialBlocks(id: string) {
  // Penyunting memakai salinan lokal; data server tidak dimuat ulang diam-diam saat jendela kembali aktif.
  return useQuery({ queryKey: adminContentKeys.blocks(id), queryFn: ({ signal }) => adminContentApi.getBlocks(id, signal), refetchOnWindowFocus: false });
}

export function useLearningAudio() {
  return useQuery({ queryKey: adminContentKeys.audio, queryFn: ({ signal }) => adminContentApi.getAudio(signal), staleTime: 5 * 60 * 1000 });
}

/** Setelah perubahan konten: daftar konten dan daftar tahapan filter Daftar Santri dimuat ulang. */
function useInvalidateContent() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: adminContentKeys.all });
    void queryClient.invalidateQueries({ queryKey: adminStudentKeys.stages });
  };
}

export function useStageMutations() {
  const invalidate = useInvalidateContent();
  const queryClient = useQueryClient();
  const options = { onSettled: invalidate };
  return {
    create: useMutation({ mutationFn: (input: StageInput) => adminContentApi.createStage(input), ...options }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: StageInput }) => adminContentApi.updateStage(id, input), ...options }),
    remove: useMutation({ mutationFn: (id: string) => adminContentApi.deleteStage(id), ...options }),
    // Urutan baru langsung dipasang di cache agar daftar tidak sempat kembali ke urutan lama.
    reorder: useMutation({ mutationFn: (orderedIds: string[]) => adminContentApi.reorderStages(orderedIds), onSuccess: (stages) => queryClient.setQueryData(adminContentKeys.stages, stages), ...options }),
  };
}

export function useMaterialMutations() {
  const invalidate = useInvalidateContent();
  const queryClient = useQueryClient();
  const options = { onSettled: invalidate };
  return {
    create: useMutation({ mutationFn: (input: MaterialInput) => adminContentApi.createMaterial(input), ...options }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: MaterialInput }) => adminContentApi.updateMaterial(id, input), ...options }),
    remove: useMutation({ mutationFn: (id: string) => adminContentApi.deleteMaterial(id), ...options }),
    reorder: useMutation({
      mutationFn: (orderedIds: string[]) => adminContentApi.reorderMaterials(orderedIds),
      onSuccess: (materials) => {
        if (materials[0]) queryClient.setQueryData(adminContentKeys.materials(materials[0].stageId), materials);
      },
      ...options,
    }),
  };
}

export function useSaveBlocks(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blocks: BlockInput[]) => adminContentApi.saveBlocks(id, blocks),
    onSuccess: (saved) => {
      queryClient.setQueryData(adminContentKeys.blocks(id), saved);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'content', 'materials'] });
      void queryClient.invalidateQueries({ queryKey: adminContentKeys.material(id) });
    },
  });
}
