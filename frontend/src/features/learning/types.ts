import type { TaskType } from '../../lib/api/types';

// SDD 5.8.
export type StageAccess = 'UNLOCKED' | 'LOCKED';

export interface StageSummary {
  id: string;
  code: string;
  title: string;
  orderIndex: number;
  access: StageAccess;
  isCompleted?: boolean;
  /** Kalimat siap tampil bila tahapan terkunci (NFR-USE-03). */
  lockReason?: string;
  materialsTotal: number;
  materialsCompleted: number;
}

/** FR-LEARN-02. */
export type MaterialStatus = 'COMPLETED' | 'AVAILABLE' | 'LOCKED';

export interface MaterialSummary {
  id: string;
  code: string;
  title: string;
  orderIndex: number;
  isRequired: boolean;
  status: MaterialStatus;
  taskCount?: number;
  tasksCompleted?: number;
  lockReason?: string;
}

export interface StageMaterials {
  stage: { id: string; title: string; access: StageAccess };
  materials: MaterialSummary[];
}

export type MaterialBlock =
  | { type: 'TEXT'; orderIndex: number; textContent?: string; arabicContent?: string; transliteration?: string }
  | { type: 'AUDIO'; orderIndex: number; audioUrl: string; durationMs: number }
  | { type: 'IMAGE'; orderIndex: number; imageUrl: string };

/** [ASUMSI] Enum status tugas pada detail materi tidak dirinci SDD. */
export type TaskStatus = 'AVAILABLE' | 'COMPLETED' | 'LOCKED';

export interface MaterialTask {
  id: string;
  type: TaskType;
  title: string;
  status: TaskStatus;
  bestScore: number | null;
  attemptCount: number;
}

export interface MaterialDetail {
  id: string;
  code: string;
  title: string;
  isRequired: boolean;
  status: MaterialStatus;
  blocks: MaterialBlock[];
  tasks: MaterialTask[];
  navigation: {
    previousMaterialId: string | null;
    nextMaterialId: string | null;
    nextMaterialLocked: boolean;
  };
}

export interface LearningProgressSnapshot {
  learningProgressPct: number;
  materialsCompleted: number;
  materialsTotal: number;
  tasksCompleted: number;
  tasksTotal: number;
}

export interface CompleteMaterialResult {
  materialId: string;
  completedAt: string;
  progress: LearningProgressSnapshot;
  /** [ASUMSI] SDD hanya menyebut "ringkasan tahapan yang baru terbuka". */
  stageUnlocked: { id: string; code: string; title: string } | null;
}

/** [ASUMSI] Isi GET /learning/continue; null bila semua materi selesai. */
export type ContinueTarget = { materialId: string; materialTitle: string; stageTitle: string } | null;
