import type { PillStatus } from '../../../components/ui/Pill';
import type { AdminAudio, AudioFilter, AudioKind, AudioStatus } from './types';

export const KIND_LABEL: Record<AudioKind, string> = { LEARNING: 'Pembelajaran', REFERENCE: 'Referensi' };
/** SRS UI-ADMIN-AUDIO-03. */
export const STATUS_LABEL: Record<AudioStatus, string> = { ACTIVE: 'AKTIF', ARCHIVED: 'ARSIP' };
export const STATUS_TONE: Record<AudioStatus, PillStatus> = { ACTIVE: 'selesai', ARCHIVED: 'terkunci' };

/** SDD 5.20: unggahan berkas dibatasi 12 MB. */
export const UPLOAD_MAX_BYTES = 12 * 1024 * 1024;

export type AudioAction = 'replace' | 'archive';

/**
 * SDD 7.7.19: tidak ada hapus. Ganti Versi hanya untuk referensi AKTIF; Arsipkan untuk audio AKTIF yang belum
 * dipakai submission (referensi yang sudah dipakai hanya dapat diganti versinya).
 */
export function availableActions(audio: Pick<AdminAudio, 'kind' | 'status' | 'usedBySubmission'>): AudioAction[] {
  if (audio.status !== 'ACTIVE') return [];
  const actions: AudioAction[] = audio.kind === 'REFERENCE' ? ['replace'] : [];
  if (!audio.usedBySubmission) actions.push('archive');
  return actions;
}

/** Pesan galat berkas sebelum diunggah, atau null bila boleh dikirim. Format rinci diperiksa server. */
export function validateAudioFile(file: Pick<File, 'type' | 'size'> | null): string | null {
  if (!file) return 'Pilih berkas audio.';
  if (!file.type.startsWith('audio/')) return 'Berkas harus berupa audio.';
  if (file.size > UPLOAD_MAX_BYTES) return 'Ukuran berkas melebihi 12 MB.';
  return null;
}

export function formatDuration(ms: number): string {
  return `${(Math.round(ms / 100) / 10).toLocaleString('id-ID')} detik`;
}

export function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(Math.round((bytes / 1024 / 1024) * 10) / 10).toLocaleString('id-ID')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const KINDS: readonly string[] = ['LEARNING', 'REFERENCE'];
const STATUSES: readonly string[] = ['ACTIVE', 'ARCHIVED'];

/** Penyaring dibaca dari URL agar tetap ada saat kembali dari halaman lain; nilai tak dikenal diabaikan. */
export function parseFilter(params: URLSearchParams): AudioFilter {
  const kind = params.get('kind') ?? '';
  const status = params.get('status') ?? '';
  return { kind: KINDS.includes(kind) ? (kind as AudioKind) : '', status: STATUSES.includes(status) ? (status as AudioStatus) : '' };
}
