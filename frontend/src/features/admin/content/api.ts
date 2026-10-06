import { apiRequest } from '../../../lib/api/client';
import type { RecordingUrl } from '../monitoring/types';
import type { AdminBlock, AdminMaterial, AdminStage, AudioAsset, BlockInput, MaterialInput, StageInput } from './types';

const stage = (id: string) => `admin/stages/${encodeURIComponent(id)}`;
const material = (id: string) => `admin/materials/${encodeURIComponent(id)}`;

// SDD 5.15 (konten) dan 5.16 (audio, minimal).
export const adminContentApi = {
  getStages: (signal?: AbortSignal): Promise<AdminStage[]> => apiRequest<AdminStage[]>('admin/stages', { signal }),
  createStage: (input: StageInput): Promise<AdminStage> => apiRequest<AdminStage>('admin/stages', { method: 'POST', body: input }),
  updateStage: (id: string, input: StageInput): Promise<AdminStage> => apiRequest<AdminStage>(stage(id), { method: 'PATCH', body: input }),
  deleteStage: (id: string): Promise<unknown> => apiRequest<unknown>(stage(id), { method: 'DELETE' }),
  /** SDD 5.15: seluruh pengenal dalam urutan baru; daftar tidak lengkap → 422 CONTENT_REORDER_INCOMPLETE. */
  reorderStages: (orderedIds: string[]): Promise<AdminStage[]> => apiRequest<AdminStage[]>('admin/stages/reorder', { method: 'PATCH', body: { orderedIds } }),

  getMaterials: (stageId: string, signal?: AbortSignal): Promise<AdminMaterial[]> => apiRequest<AdminMaterial[]>(`admin/materials?stageId=${encodeURIComponent(stageId)}`, { signal }),
  getMaterial: (id: string, signal?: AbortSignal): Promise<AdminMaterial> => apiRequest<AdminMaterial>(material(id), { signal }),
  createMaterial: (input: MaterialInput): Promise<AdminMaterial> => apiRequest<AdminMaterial>('admin/materials', { method: 'POST', body: input }),
  updateMaterial: (id: string, input: MaterialInput): Promise<AdminMaterial> => apiRequest<AdminMaterial>(material(id), { method: 'PATCH', body: input }),
  deleteMaterial: (id: string): Promise<unknown> => apiRequest<unknown>(material(id), { method: 'DELETE' }),
  reorderMaterials: (orderedIds: string[]): Promise<AdminMaterial[]> => apiRequest<AdminMaterial[]>('admin/materials/reorder', { method: 'PATCH', body: { orderedIds } }),

  getBlocks: (id: string, signal?: AbortSignal): Promise<AdminBlock[]> => apiRequest<AdminBlock[]>(`${material(id)}/blocks`, { signal }),
  saveBlocks: (id: string, blocks: BlockInput[]): Promise<AdminBlock[]> => apiRequest<AdminBlock[]>(`${material(id)}/blocks`, { method: 'PUT', body: { blocks } }),

  getAudio: (signal?: AbortSignal): Promise<AudioAsset[]> => apiRequest<AudioAsset[]>('admin/audio?kind=LEARNING', { signal }),
  /** Diminta saat pratinjau diputar; hasilnya tidak disimpan di cache (SDD 5.16, NFR-PRIV-02). */
  getAudioUrl: (id: string): Promise<RecordingUrl> => apiRequest<RecordingUrl>(`admin/audio/${encodeURIComponent(id)}/url`),
};
