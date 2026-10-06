import type { PillStatus } from '../../../components/ui/Pill';
import type { ContentStatus } from './types';

/** Lencana teks SDD 7.7.18. */
export const STATUS_LABEL: Record<ContentStatus, string> = { DRAFT: 'DRAFT', ACTIVE: 'AKTIF', INACTIVE: 'NONAKTIF' };
export const STATUS_TONE: Record<ContentStatus, PillStatus> = { DRAFT: 'belum', ACTIVE: 'selesai', INACTIVE: 'terkunci' };

export type ContentAction = 'activate' | 'deactivate' | 'reactivate' | 'toDraft' | 'delete';

export const ACTION_LABEL: Record<ContentAction, string> = {
  activate: 'Aktifkan',
  deactivate: 'Nonaktifkan',
  reactivate: 'Aktifkan kembali',
  toDraft: 'Kembalikan ke draf',
  delete: 'Hapus',
};

export const ACTION_TARGET: Record<Exclude<ContentAction, 'delete'>, ContentStatus> = {
  activate: 'ACTIVE',
  deactivate: 'INACTIVE',
  reactivate: 'ACTIVE',
  toDraft: 'DRAFT',
};

/**
 * Aksi yang ditawarkan menurut SDD 3.5.3 dan 7.7.18: transisi tidak sah tidak ditampilkan. Hapus hanya untuk
 * DRAFT yang belum dirujuk; "kembalikan ke draf" hanya untuk AKTIF yang belum dirujuk.
 */
export function availableActions(status: ContentStatus, isReferenced: boolean): ContentAction[] {
  if (status === 'DRAFT') return isReferenced ? ['activate'] : ['activate', 'delete'];
  if (status === 'ACTIVE') return isReferenced ? ['deactivate'] : ['deactivate', 'toDraft'];
  return ['reactivate'];
}
