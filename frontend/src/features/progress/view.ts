import type { PillStatus } from '../../components/ui/Pill';
import type { HistoryItem } from './types';

/**
 * Warna penanda status riwayat dari evaluationStatus; teksnya tetap displayStatus dari server.
 * FAILED memakai state/failed (bukan merah, SDD 7.3.1). Dengar-Pilih tidak punya evaluationStatus.
 */
export function historyTone(item: Pick<HistoryItem, 'evaluationStatus'>): PillStatus {
  switch (item.evaluationStatus) {
    case 'FAILED':
      return 'gagal';
    case 'SUBMITTED':
    case 'PROCESSING':
      return 'diproses';
    default:
      return 'selesai';
  }
}

/** Baris Dengar-Pilih menaut ke detail percobaan; Dengar-Tirukan belum ([TBD]). */
export function historyLink(item: Pick<HistoryItem, 'taskType' | 'attemptId'>): string | null {
  return item.taskType === 'QUIZ' ? `/riwayat/${item.attemptId}` : null;
}
