// Aturan bisnis murni untuk data tiruan, mengikuti SDD/SRS agar perilaku mock mendekati backend.
import type { MaterialStatus, StageAccess } from '../../../features/learning/types';
import type { ChartTrend } from '../../../features/statistics/types';
import type { EvaluationStatus, FeedbackCategory } from '../types';
import type { MockMaterial, MockStage } from './data/content';

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** FR-QUIZ-06 / SDD 3.9.3: (benar / jumlah soal) × 100, dua desimal. */
export function quizScore(correct: number, total: number): number {
  return total > 0 ? round2((correct / total) * 100) : 0;
}

/**
 * SRS FR-FEEDBACK-02: 90–100 Sangat Baik, 80–89 Baik, 70–79 Cukup, 0–69 Perlu Latihan.
 * [TBD] Kategori ditentukan dari skor asli tanpa pembulatan (89,50 → BAIK); aturan
 * pembulatan perlu dikonfirmasi ke backend. Pembulatan hanya untuk tampilan.
 */
export function feedbackCategory(score: number): FeedbackCategory {
  if (score >= 90) return 'SANGAT_BAIK';
  if (score >= 80) return 'BAIK';
  if (score >= 70) return 'CUKUP';
  return 'PERLU_LATIHAN';
}

export const FEEDBACK_LABEL: Record<FeedbackCategory, string> = {
  SANGAT_BAIK: 'Sangat Baik',
  BAIK: 'Baik',
  CUKUP: 'Cukup',
  PERLU_LATIHAN: 'Perlu Latihan',
};

export interface AccessState {
  stageAccess: Map<string, StageAccess>;
  materialStatus: Map<string, MaterialStatus>;
}

/**
 * SDD 3.8.3: tahapan pertama terbuka; tahapan ke-n terbuka bila seluruh materi wajib tahapan
 * ke-(n-1) selesai. Di tahapan terbuka, materi terbuka berurutan; materi selesai tetap terbuka.
 * Nilai tugas tidak pernah menjadi syarat (BR-LEARN-01).
 */
export function computeAccess(stages: MockStage[], materials: MockMaterial[], completed: Set<string>): AccessState {
  const stageAccess = new Map<string, StageAccess>();
  const materialStatus = new Map<string, MaterialStatus>();
  const sorted = [...stages].sort((a, b) => a.orderIndex - b.orderIndex);

  sorted.forEach((stage, index) => {
    const stageMaterials = materials.filter((m) => m.stageId === stage.id).sort((a, b) => a.orderIndex - b.orderIndex);
    const previous = sorted[index - 1];
    const unlocked =
      !previous || materials.filter((m) => m.stageId === previous.id && m.isRequired).every((m) => completed.has(m.id));
    stageAccess.set(stage.id, unlocked ? 'UNLOCKED' : 'LOCKED');

    stageMaterials.forEach((material, materialIndex) => {
      if (!unlocked) return materialStatus.set(material.id, 'LOCKED');
      if (completed.has(material.id)) return materialStatus.set(material.id, 'COMPLETED');
      const previousMaterial = stageMaterials[materialIndex - 1];
      materialStatus.set(material.id, !previousMaterial || completed.has(previousMaterial.id) ? 'AVAILABLE' : 'LOCKED');
    });
  });

  return { stageAccess, materialStatus };
}

/** [ASUMSI] Waktu tiruan: SUBMITTED selama 2 detik, PROCESSING sampai detik ke-8, lalu hasil akhir. */
export const PROCESSING_AFTER_MS = 2000;
export const FINISHED_AFTER_MS = 8000;

export function imitationStatusAt(submittedAtMs: number, outcome: 'EVALUATED' | 'FAILED', nowMs: number): EvaluationStatus {
  const elapsed = nowMs - submittedAtMs;
  if (elapsed < PROCESSING_AFTER_MS) return 'SUBMITTED';
  if (elapsed < FINISHED_AFTER_MS) return 'PROCESSING';
  return outcome;
}

/** [ASUMSI] SDD 5.12 hanya menyebut "perbandingan tiga titik terakhir": titik ke-3 vs titik ke-1. */
export function chartTrend(scores: number[]): ChartTrend {
  if (scores.length < 3) return 'INSUFFICIENT_DATA';
  const [first, , last] = scores.slice(-3);
  if (last > first) return 'UP';
  if (last < first) return 'DOWN';
  return 'FLAT';
}
