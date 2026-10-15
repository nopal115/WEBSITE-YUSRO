import { apiRequest } from '../../lib/api/client';
import type { CompleteMaterialResult, ContinueTarget, MaterialDetail, StageMaterials, StageSummary } from './types';

// SDD 5.8.
export const learningApi = {
  getStages: (signal?: AbortSignal): Promise<StageSummary[]> => apiRequest<StageSummary[]>('learning/stages', { signal }),

  getStageMaterials: (stageId: string, signal?: AbortSignal): Promise<StageMaterials> =>
    apiRequest<StageMaterials>(`learning/stages/${encodeURIComponent(stageId)}/materials`, { signal }),

  getMaterial: (materialId: string, signal?: AbortSignal): Promise<MaterialDetail> =>
    apiRequest<MaterialDetail>(`learning/materials/${encodeURIComponent(materialId)}`, { signal }),

  completeMaterial: (materialId: string): Promise<CompleteMaterialResult> =>
    apiRequest<CompleteMaterialResult>(`learning/materials/${encodeURIComponent(materialId)}/complete`, { method: 'POST' }),

  getContinue: (signal?: AbortSignal): Promise<ContinueTarget> => apiRequest<ContinueTarget>('learning/continue', { signal }),
};
