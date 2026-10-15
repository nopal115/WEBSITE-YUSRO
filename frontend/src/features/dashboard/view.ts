import type { DashboardData } from './types';

const scoreFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

/** [REKOMENDASI] Nilai ditampilkan tanpa nol di belakang dan dengan desimal koma: 78, 87,5. */
export function formatScore(score: number): string {
  return scoreFormat.format(score);
}

export type DashboardCta =
  | { kind: 'continue' | 'start'; materialId: string }
  /** continueTarget null: semua materi telah selesai. */
  | { kind: 'finished' };

/**
 * Satu-satunya ajakan bertindak utama (SDD 7.7.4, FR-DASH-S-02): "LANJUTKAN PEMBELAJARAN",
 * atau "MULAI BELAJAR" untuk santri yang belum pernah membuka materi.
 */
export function dashboardCta(data: Pick<DashboardData, 'continueTarget' | 'lastMaterial'>): DashboardCta {
  if (!data.continueTarget) return { kind: 'finished' };
  return { kind: data.lastMaterial ? 'continue' : 'start', materialId: data.continueTarget.materialId };
}
