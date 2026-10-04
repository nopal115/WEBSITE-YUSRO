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

/**
 * Tautan detail percobaan. Dengar-Tirukan diberi ?jenis=tirukan agar halaman detail memanggil
 * GET imitation/submissions/:id (attemptId = submissionId, contoh SDD 5.10/5.11); tetap benar saat dimuat ulang.
 */
export function historyLink(item: Pick<HistoryItem, 'taskType' | 'attemptId'>): string {
  const path = `/riwayat/${encodeURIComponent(item.attemptId)}`;
  return item.taskType === 'IMITATION' ? `${path}?jenis=tirukan` : path;
}
