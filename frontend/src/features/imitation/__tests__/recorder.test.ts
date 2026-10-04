import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  durationHint,
  formatElapsed,
  initialRecorderState,
  MIC_READY_MESSAGE,
  needsLeaveGuard,
  pickMimeType,
  recorderReducer,
  recordingFileName,
  validateRecording,
  type Recording,
  type RecorderEvent,
  type RecorderState,
} from '../recorder';
import type { ImitationConstraints, SubmitRecordingResult } from '../types';

const constraints: ImitationConstraints = {
  acceptedFormats: ['audio/webm;codecs=opus', 'audio/mp4'],
  minDurationMs: 1000,
  maxDurationMs: 30000,
  maxSizeBytes: 5242880,
  cooldownSeconds: 10,
};

const recording = (durationMs = 3000, size = 2000): Recording => ({
  blob: new Blob([new Uint8Array(size)], { type: 'audio/webm' }),
  mimeType: 'audio/webm;codecs=opus',
  durationMs,
  idempotencyKey: 'kunci-1',
});

const accepted: SubmitRecordingResult = {
  submissionId: 'sub-1',
  attemptNo: 1,
  evaluationStatus: 'SUBMITTED',
  score: null,
  submittedAt: '2026-10-04T10:00:00.000Z',
  polling: { recommendedSchedule: [{ intervalMs: 3000, times: 5 }], stopAfterMs: 300000 },
};

const run = (state: RecorderState, ...events: RecorderEvent[]) => events.reduce(recorderReducer, state);
const recorded = (rec = recording()): RecorderEvent => ({ type: 'RECORDED', recording: rec, constraints });

afterEach(() => vi.useRealTimers());

describe('recorderReducer', () => {
  it('alur normal IDLE → RECORDING → READY → UPLOADING → SUBMITTED', () => {
    const recordingState = run(initialRecorderState, { type: 'START' });
    expect(recordingState.status).toBe('RECORDING');
    const ready = run(recordingState, recorded());
    expect(ready).toMatchObject({ status: 'READY', recording: { idempotencyKey: 'kunci-1' } });
    const uploading = run(ready, { type: 'UPLOAD' });
    expect(uploading.status).toBe('UPLOADING');
    expect(run(uploading, { type: 'UPLOADED', result: accepted })).toEqual({ status: 'SUBMITTED', result: accepted });
  });

  it('rekaman di bawah minDurationMs menjadi TOO_SHORT, lalu bisa merekam lagi', () => {
    const tooShort = run(initialRecorderState, { type: 'START' }, recorded(recording(999)));
    expect(tooShort).toEqual({ status: 'TOO_SHORT', message: 'Rekaman terlalu pendek. Tahan tombol rekam sekurang-kurangnya 1 detik.' });
    expect(run(tooShort, { type: 'START' }).status).toBe('RECORDING');
  });

  it('rekaman terlalu besar kembali ke IDLE dengan pesan', () => {
    const state = run(initialRecorderState, { type: 'START' }, recorded(recording(3000, 5242881)));
    expect(state).toEqual({ status: 'IDLE', message: 'Ukuran rekaman melebihi 5 MB.' });
  });

  it('galat unggah kembali ke READY dengan rekaman dan kunci yang sama', () => {
    const uploading = run(initialRecorderState, { type: 'START' }, recorded(), { type: 'UPLOAD' });
    const failed = run(uploading, { type: 'UPLOAD_FAILED', error: { message: 'Penyimpanan sedang bermasalah.' } });
    expect(failed).toMatchObject({ status: 'READY', recording: { idempotencyKey: 'kunci-1' }, error: { message: 'Penyimpanan sedang bermasalah.' } });
    expect(run(failed, { type: 'UPLOAD' }).status).toBe('UPLOADING');
  });

  it('audio ditolak (413/422) tidak bisa dikirim ulang, hanya direkam ulang', () => {
    const uploading = run(initialRecorderState, { type: 'START' }, recorded(), { type: 'UPLOAD' });
    const rejected = run(uploading, { type: 'UPLOAD_FAILED', error: { message: 'Rekaman tidak terdengar.', canResend: false } });
    expect(run(rejected, { type: 'UPLOAD' })).toBe(rejected);
    expect(run(rejected, { type: 'DISCARD' })).toEqual({ status: 'IDLE' });
  });

  it('UPLOAD ditahan selama hitung mundur 429', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const uploading = run(initialRecorderState, { type: 'START' }, recorded(), { type: 'UPLOAD' });
    const cooling = run(uploading, { type: 'UPLOAD_FAILED', error: { message: 'Tunggu.', cooldownUntil: 10000 } });
    expect(run(cooling, { type: 'UPLOAD' }).status).toBe('READY');
    vi.setSystemTime(10001);
    expect(run(cooling, { type: 'UPLOAD' }).status).toBe('UPLOADING');
  });

  it('izin ditolak, mikrofon siap, dan tidak didukung', () => {
    expect(run(initialRecorderState, { type: 'PERMISSION_DENIED' })).toEqual({ status: 'PERMISSION_DENIED' });
    expect(run(initialRecorderState, { type: 'MIC_READY' })).toEqual({ status: 'IDLE', message: MIC_READY_MESSAGE });
    expect(run(initialRecorderState, { type: 'UNSUPPORTED' })).toEqual({ status: 'UNSUPPORTED' });
  });

  it('rekam ulang dan reset', () => {
    const ready = run(initialRecorderState, { type: 'START' }, recorded());
    expect(run(ready, { type: 'DISCARD' })).toEqual({ status: 'IDLE' });
    const submitted = run(ready, { type: 'UPLOAD' }, { type: 'UPLOADED', result: accepted });
    expect(run(submitted, { type: 'RESET' })).toEqual({ status: 'IDLE' });
  });

  it('transisi tidak sah tidak mengubah keadaan', () => {
    const cases: [RecorderState, RecorderEvent][] = [
      [initialRecorderState, recorded()],
      [initialRecorderState, { type: 'UPLOAD' }],
      [initialRecorderState, { type: 'UPLOADED', result: accepted }],
      [{ status: 'RECORDING' }, { type: 'START' }],
      [{ status: 'RECORDING' }, { type: 'UPLOAD' }],
      [{ status: 'UPLOADING', recording: recording() }, { type: 'START' }],
      [{ status: 'UPLOADING', recording: recording() }, { type: 'DISCARD' }],
      [{ status: 'SUBMITTED', result: accepted }, { type: 'START' }],
      [{ status: 'PERMISSION_DENIED' }, { type: 'START' }],
      [{ status: 'UNSUPPORTED' }, { type: 'START' }],
    ];
    for (const [state, event] of cases) expect(recorderReducer(state, event)).toBe(state);
  });

  it('pemblokir keluar hanya aktif di RECORDING, READY, UPLOADING', () => {
    const states: RecorderState[] = [
      { status: 'UNSUPPORTED' },
      { status: 'PERMISSION_DENIED' },
      { status: 'IDLE' },
      { status: 'RECORDING' },
      { status: 'TOO_SHORT', message: '' },
      { status: 'READY', recording: recording() },
      { status: 'UPLOADING', recording: recording() },
      { status: 'SUBMITTED', result: accepted },
    ];
    expect(states.filter(needsLeaveGuard).map((s) => s.status)).toEqual(['RECORDING', 'READY', 'UPLOADING']);
  });
});

describe('pickMimeType', () => {
  it('mengikuti urutan acceptedFormats', () => {
    expect(pickMimeType(constraints.acceptedFormats, () => true)).toBe('audio/webm;codecs=opus');
    expect(pickMimeType(constraints.acceptedFormats, (type) => type === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType(constraints.acceptedFormats, () => false)).toBeNull();
    expect(pickMimeType([], () => true)).toBeNull();
  });
});

describe('recordingFileName', () => {
  it('ekstensi sesuai format', () => {
    expect(recordingFileName('audio/webm;codecs=opus')).toBe('rekaman.webm');
    expect(recordingFileName('audio/mp4')).toBe('rekaman.mp4');
    expect(recordingFileName('audio/mp4;codecs=mp4a.40.2')).toBe('rekaman.mp4');
    expect(recordingFileName('audio/ogg')).toBe('rekaman');
  });
});

describe('validateRecording', () => {
  it('batas durasi dan ukuran tepat di ambang', () => {
    expect(validateRecording({ durationMs: 1000, size: 1 }, constraints)).toEqual({ ok: true });
    expect(validateRecording({ durationMs: 30000, size: 5242880 }, constraints)).toEqual({ ok: true });
    expect(validateRecording({ durationMs: 999, size: 1 }, constraints)).toMatchObject({ ok: false, reason: 'TOO_SHORT' });
    expect(validateRecording({ durationMs: 30001, size: 1 }, constraints)).toEqual({ ok: false, reason: 'TOO_LONG', message: 'Durasi rekaman harus antara 1 dan 30 detik.' });
    expect(validateRecording({ durationMs: 3000, size: 5242881 }, constraints)).toMatchObject({ ok: false, reason: 'TOO_LARGE' });
    expect(validateRecording({ durationMs: 3000, size: 0 }, constraints)).toMatchObject({ ok: false, reason: 'EMPTY' });
  });

  it('pesan memakai angka dari constraints', () => {
    const other = { ...constraints, minDurationMs: 2000, maxDurationMs: 60000, maxSizeBytes: 10485760 };
    expect(validateRecording({ durationMs: 1500, size: 1 }, other)).toMatchObject({ message: 'Rekaman terlalu pendek. Tahan tombol rekam sekurang-kurangnya 2 detik.' });
    expect(validateRecording({ durationMs: 3000, size: 10485761 }, other)).toMatchObject({ message: 'Ukuran rekaman melebihi 10 MB.' });
    expect(durationHint(other)).toBe('Durasi 2–60 detik.');
    expect(durationHint({ ...constraints, minDurationMs: 1500 })).toBe('Durasi 1,5–30 detik.');
  });
});

describe('formatElapsed', () => {
  it('mm:ss', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(12900)).toBe('00:12');
    expect(formatElapsed(125000)).toBe('02:05');
    expect(formatElapsed(-5)).toBe('00:00');
  });
});
