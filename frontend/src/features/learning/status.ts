import { CheckCircle2, Lock, LockOpen, type LucideIcon } from 'lucide-react';
import type { MaterialStatus, MaterialSummary, StageSummary } from './types';

export interface StatusBadge {
  icon: LucideIcon;
  label: string;
}

/**
 * Penanda keadaan tahapan (SDD 7.7.5): ikon dan teks, tidak hanya warna.
 * Status akses diambil apa adanya dari API; frontend tidak menghitung ulang.
 */
export function stageBadge(stage: Pick<StageSummary, 'access' | 'isCompleted'>): StatusBadge {
  if (stage.access === 'LOCKED') return { icon: Lock, label: 'Terkunci' };
  if (stage.isCompleted) return { icon: CheckCircle2, label: 'Selesai' };
  return { icon: LockOpen, label: 'Terbuka' };
}

export interface MaterialRowState {
  canOpen: boolean;
  /** Label tindakan; "Pelajari ulang" untuk materi selesai (SDD 7.7.6, FR-LEARN-06). */
  actionLabel: string | null;
  badge: StatusBadge;
}

export function materialRow(material: Pick<MaterialSummary, 'status'>): MaterialRowState {
  switch (material.status) {
    case 'COMPLETED':
      return { canOpen: true, actionLabel: 'Pelajari ulang', badge: { icon: CheckCircle2, label: 'Selesai' } };
    case 'AVAILABLE':
      return { canOpen: true, actionLabel: 'Mulai', badge: { icon: LockOpen, label: 'Tersedia' } };
    default:
      return { canOpen: false, actionLabel: null, badge: { icon: Lock, label: 'Terkunci' } };
  }
}

export type CompletionState = 'done' | 'ready' | 'blocked';

/**
 * Tombol "Selesaikan Materi" aktif setelah akhir konten tercapai (SRS FR-LEARN-05, SDD 7.7.7).
 * Syarat "audio wajib diputar" pada SDD 3.8.4 tidak dipakai karena kontrak API tidak menandai
 * audio mana yang wajib (keputusan proyek).
 */
export function completionState(status: MaterialStatus, reachedEnd: boolean): CompletionState {
  if (status === 'COMPLETED') return 'done';
  return reachedEnd ? 'ready' : 'blocked';
}
