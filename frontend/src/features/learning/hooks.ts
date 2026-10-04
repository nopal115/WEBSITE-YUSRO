import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learningApi } from './api';

export const learningKeys = {
  all: ['learning'] as const,
  stages: ['learning', 'stages'] as const,
  stage: (stageId: string) => ['learning', 'stage', stageId] as const,
  material: (materialId: string) => ['learning', 'material', materialId] as const,
};

export function useStages() {
  return useQuery({ queryKey: learningKeys.stages, queryFn: ({ signal }) => learningApi.getStages(signal) });
}

export function useStageMaterials(stageId: string) {
  return useQuery({ queryKey: learningKeys.stage(stageId), queryFn: ({ signal }) => learningApi.getStageMaterials(stageId, signal) });
}

export function useMaterial(materialId: string) {
  return useQuery({ queryKey: learningKeys.material(materialId), queryFn: ({ signal }) => learningApi.getMaterial(materialId, signal) });
}

/** POST complete bersifat idempoten (SDD 5.23); data yang terdampak diinvalidasi setelahnya. */
export function useCompleteMaterial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: learningApi.completeMaterial,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: learningKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]),
  });
}
