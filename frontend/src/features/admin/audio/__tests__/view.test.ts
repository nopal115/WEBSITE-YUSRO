import { describe, expect, it } from 'vitest';
import { availableActions, formatDuration, formatSize, parseFilter, UPLOAD_MAX_BYTES, validateAudioFile } from '../view';

describe('availableActions (SDD 7.7.19)', () => {
  it('referensi aktif yang belum dipakai: Ganti Versi dan Arsipkan', () => {
    expect(availableActions({ kind: 'REFERENCE', status: 'ACTIVE', usedBySubmission: false })).toEqual(['replace', 'archive']);
  });

  it('referensi yang sudah dipakai submission hanya dapat diganti versinya', () => {
    expect(availableActions({ kind: 'REFERENCE', status: 'ACTIVE', usedBySubmission: true })).toEqual(['replace']);
  });

  it('audio pembelajaran aktif hanya dapat diarsipkan', () => {
    expect(availableActions({ kind: 'LEARNING', status: 'ACTIVE', usedBySubmission: false })).toEqual(['archive']);
  });

  it('audio arsip tidak punya aksi', () => {
    expect(availableActions({ kind: 'REFERENCE', status: 'ARCHIVED', usedBySubmission: true })).toEqual([]);
    expect(availableActions({ kind: 'LEARNING', status: 'ARCHIVED', usedBySubmission: false })).toEqual([]);
  });
});

describe('validateAudioFile', () => {
  it('menolak berkas kosong, bukan audio, dan lebih dari 12 MB', () => {
    expect(validateAudioFile(null)).toBe('Pilih berkas audio.');
    expect(validateAudioFile({ type: 'image/png', size: 10 })).toBe('Berkas harus berupa audio.');
    expect(validateAudioFile({ type: 'audio/wav', size: UPLOAD_MAX_BYTES + 1 })).toBe('Ukuran berkas melebihi 12 MB.');
  });

  it('menerima audio sampai 12 MB', () => {
    expect(validateAudioFile({ type: 'audio/mpeg', size: UPLOAD_MAX_BYTES })).toBeNull();
  });
});

describe('format dan penyaring', () => {
  it('memformat durasi dan ukuran', () => {
    expect(formatDuration(2500)).toBe('2,5 detik');
    expect(formatSize(64000)).toBe('63 KB');
    expect(formatSize(3 * 1024 * 1024)).toBe('3 MB');
  });

  it('membaca penyaring dari URL dan mengabaikan nilai tak dikenal', () => {
    expect(parseFilter(new URLSearchParams('kind=REFERENCE&status=ARCHIVED'))).toEqual({ kind: 'REFERENCE', status: 'ARCHIVED' });
    expect(parseFilter(new URLSearchParams('kind=RECORDING&status=x'))).toEqual({ kind: '', status: '' });
  });
});
