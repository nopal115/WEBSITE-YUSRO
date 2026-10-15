import { formatScore } from '../../dashboard/view';
import type { AttentionItem, AttentionReason } from './types';

/** Lencana teks alasan (SDD 7.7.16). */
export const REASON_LABEL: Record<AttentionReason, string> = {
  LOW_PROGRESS: 'Progress rendah',
  SCORE_DECLINE: 'Nilai menurun',
  NO_ATTEMPT: 'Belum mengerjakan tugas',
};

/** [ASUMSI] Kode alasan yang tidak dikenal tetap tampil, dengan label umum. */
export function reasonLabel(code: string): string {
  return REASON_LABEL[code as AttentionReason] ?? 'Perlu diperhatikan';
}

/** Angka pendukung per alasan, mis. "Progress 22%", "Turun 17 poin (88 → 71)", "6 tugas tersedia". */
export function attentionDetails(item: AttentionItem): string[] {
  const details: string[] = [];
  if (item.reasons.includes('LOW_PROGRESS') && item.learningProgressPct !== undefined) details.push(`Progress ${item.learningProgressPct}%`);
  if (item.reasons.includes('SCORE_DECLINE') && item.delta !== undefined) {
    const range = item.previousBest !== undefined && item.latestBest !== undefined ? ` (${formatScore(item.previousBest)} → ${formatScore(item.latestBest)})` : '';
    details.push(`Turun ${formatScore(Math.abs(item.delta))} poin${range}`);
  }
  if (item.reasons.includes('NO_ATTEMPT') && item.availableTasks !== undefined) details.push(`${item.availableTasks} tugas tersedia`);
  return details;
}

export type ServiceTone = 'ok' | 'loading' | 'down';

/**
 * [ASUMSI] Pemetaan serviceStatus: "ok" → berjalan normal; "loading" → model sedang dimuat
 * (SDD 8.11.3); nilai lain atau kosong → terganggu. Ditampilkan dengan ikon + teks, bukan warna saja.
 */
export function serviceStatusView(status: string | null | undefined): { tone: ServiceTone; label: string } {
  if (status === 'ok') return { tone: 'ok', label: 'Berjalan normal' };
  if (status === 'loading') return { tone: 'loading', label: 'Sedang memuat model' };
  return { tone: 'down', label: 'Terganggu' };
}
