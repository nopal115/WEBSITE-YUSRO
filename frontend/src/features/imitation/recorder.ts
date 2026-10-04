import type { ImitationConstraints, SubmitRecordingResult } from './types';

/** Rekaman di memori peramban saja; belum menjadi submission sampai terkirim (BR-IMITATE-05/06). */
export interface Recording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  /** Dibuat sekali per rekaman; dipakai ulang saat mengulang unggahan rekaman yang sama (SDD 5.23). */
  idempotencyKey: string;
}

export interface UploadError {
  message: string;
  /** 429: tombol kirim nonaktif sampai waktu ini (ms epoch). */
  cooldownUntil?: number;
}

/** Mesin keadaan perekam SDD 7.6.2, tanpa CONVERTING (rekaman diunggah dalam format asli perangkat). */
export type RecorderState =
  | { status: 'UNSUPPORTED' }
  | { status: 'PERMISSION_DENIED' }
  | { status: 'IDLE'; message?: string }
  | { status: 'RECORDING' }
  | { status: 'TOO_SHORT'; message: string }
  | { status: 'READY'; recording: Recording; error?: UploadError }
  | { status: 'UPLOADING'; recording: Recording }
  | { status: 'SUBMITTED'; result: SubmitRecordingResult };

export type RecorderEvent =
  | { type: 'UNSUPPORTED' }
  | { type: 'PERMISSION_DENIED' }
  /** Izin baru diberikan tetapi tombol sudah dilepas sebelum mikrofon siap. */
  | { type: 'MIC_READY' }
  | { type: 'START' }
  | { type: 'RECORDED'; recording: Recording; constraints: ImitationConstraints }
  | { type: 'RECORD_FAILED' }
  | { type: 'DISCARD' }
  | { type: 'UPLOAD' }
  | { type: 'UPLOAD_FAILED'; error: UploadError }
  | { type: 'UPLOADED'; result: SubmitRecordingResult }
  /** Kembali ke IDLE: Coba Lagi, Kirim Ulang Rekaman, atau 409 (evaluasi lain masih berjalan). */
  | { type: 'RESET' };

export const MIC_READY_MESSAGE = 'Mikrofon siap. Tekan dan tahan untuk merekam.';
const RECORD_FAILED_MESSAGE = 'Rekaman gagal dibuat. Silakan rekam ulang.';

export const initialRecorderState: RecorderState = { status: 'IDLE' };

const canStart = (state: RecorderState) => state.status === 'IDLE' || state.status === 'TOO_SHORT';

/** Transisi yang tidak sah mengembalikan keadaan yang sama. */
export function recorderReducer(state: RecorderState, event: RecorderEvent): RecorderState {
  switch (event.type) {
    case 'UNSUPPORTED':
      return { status: 'UNSUPPORTED' };
    case 'PERMISSION_DENIED':
      return canStart(state) || state.status === 'RECORDING' ? { status: 'PERMISSION_DENIED' } : state;
    case 'MIC_READY':
      return canStart(state) ? { status: 'IDLE', message: MIC_READY_MESSAGE } : state;
    case 'START':
      return canStart(state) ? { status: 'RECORDING' } : state;
    case 'RECORDED': {
      if (state.status !== 'RECORDING') return state;
      const check = validateRecording({ durationMs: event.recording.durationMs, size: event.recording.blob.size }, event.constraints);
      if (check.ok) return { status: 'READY', recording: event.recording };
      return check.reason === 'TOO_SHORT' ? { status: 'TOO_SHORT', message: check.message } : { status: 'IDLE', message: check.message };
    }
    case 'RECORD_FAILED':
      return state.status === 'RECORDING' ? { status: 'IDLE', message: RECORD_FAILED_MESSAGE } : state;
    case 'DISCARD':
      return state.status === 'READY' ? { status: 'IDLE' } : state;
    case 'UPLOAD':
      if (state.status !== 'READY') return state;
      if (state.error?.cooldownUntil !== undefined && state.error.cooldownUntil > Date.now()) return state;
      return { status: 'UPLOADING', recording: state.recording };
    case 'UPLOAD_FAILED':
      return state.status === 'UPLOADING' ? { status: 'READY', recording: state.recording, error: event.error } : state;
    case 'UPLOADED':
      return state.status === 'UPLOADING' ? { status: 'SUBMITTED', result: event.result } : state;
    case 'RESET':
      return state.status === 'SUBMITTED' || state.status === 'UPLOADING' || state.status === 'READY' ? { status: 'IDLE' } : state;
  }
}

/** Rekaman belum terkirim: peringatan beforeunload dan pemblokir navigasi aktif (FR-IMITATE-08). */
export function needsLeaveGuard(state: RecorderState): boolean {
  return state.status === 'RECORDING' || state.status === 'READY' || state.status === 'UPLOADING';
}

/** Format pertama dari acceptedFormats (urutan server) yang didukung MediaRecorder; null = UNSUPPORTED. */
export function pickMimeType(acceptedFormats: string[], isTypeSupported: (type: string) => boolean): string | null {
  return acceptedFormats.find((format) => isTypeSupported(format)) ?? null;
}

const baseType = (mime: string) => mime.split(';')[0].trim().toLowerCase();
const EXTENSIONS: Record<string, string> = { 'audio/webm': 'webm', 'audio/mp4': 'mp4' };

/** Nama berkas unggahan dengan ekstensi sesuai format (SDD 5.10: .webm atau .mp4). */
export function recordingFileName(mimeType: string): string {
  const extension = EXTENSIONS[baseType(mimeType)];
  return extension ? `rekaman.${extension}` : 'rekaman';
}

const secondsFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const formatSeconds = (ms: number) => secondsFormat.format(ms / 1000);
const formatMegabytes = (bytes: number) => secondsFormat.format(bytes / 1048576);

export type RecordingCheck =
  | { ok: true }
  | { ok: false; reason: 'TOO_SHORT' | 'TOO_LONG' | 'TOO_LARGE' | 'EMPTY'; message: string };

/** Validasi klien sebelum unggah (kenyamanan; backend tetap memvalidasi ulang, SDD 5.10). Angka dari constraints. */
export function validateRecording({ durationMs, size }: { durationMs: number; size: number }, constraints: ImitationConstraints): RecordingCheck {
  const { minDurationMs, maxDurationMs, maxSizeBytes } = constraints;
  if (durationMs < minDurationMs) {
    return { ok: false, reason: 'TOO_SHORT', message: `Rekaman terlalu pendek. Tahan tombol rekam sekurang-kurangnya ${formatSeconds(minDurationMs)} detik.` };
  }
  if (durationMs > maxDurationMs) {
    return { ok: false, reason: 'TOO_LONG', message: `Durasi rekaman harus antara ${formatSeconds(minDurationMs)} dan ${formatSeconds(maxDurationMs)} detik.` };
  }
  if (size === 0) return { ok: false, reason: 'EMPTY', message: 'Berkas rekaman tidak dapat dibaca. Silakan rekam ulang.' };
  if (size > maxSizeBytes) return { ok: false, reason: 'TOO_LARGE', message: `Ukuran rekaman melebihi ${formatMegabytes(maxSizeBytes)} MB.` };
  return { ok: true };
}

/** Keterangan batas durasi untuk instruksi (pengganti "Durasi 2–60 detik" di SDD 7.7.10). */
export function durationHint(constraints: ImitationConstraints): string {
  return `Durasi ${formatSeconds(constraints.minDurationMs)}–${formatSeconds(constraints.maxDurationMs)} detik.`;
}

/** mm:ss, mis. "00:12" (SDD 7.7.10). */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
