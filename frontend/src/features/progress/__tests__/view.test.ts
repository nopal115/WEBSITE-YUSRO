import { describe, expect, it } from 'vitest';
import { formatDateStamp, formatDateTime } from '../../../lib/utils/format';
import { shouldShowChart, TREND_LABEL } from '../../statistics/view';
import { historyLink, historyTone } from '../view';

describe('formatDateStamp (nama berkas laporan)', () => {
  it('memakai tanggal lokal, bukan UTC: sebelum pukul 07.00 WIB tetap tanggal hari itu', () => {
    // 2 Sep 2026 pukul 06.30 WIB = 1 Sep 2026 pukul 23.30 UTC.
    const pagiWib = new Date('2026-09-01T23:30:00.000Z');
    expect(formatDateStamp(pagiWib, 'Asia/Jakarta')).toBe('2026-09-02');
    expect(pagiWib.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(formatDateStamp(pagiWib, 'UTC')).toBe('2026-09-01');
  });

  it('format YYYY-MM-DD dengan nol di depan', () => {
    expect(formatDateStamp(new Date('2026-01-05T03:00:00.000Z'), 'Asia/Jakarta')).toBe('2026-01-05');
  });
});

describe('formatDateTime', () => {
  it('format Indonesia "2 Sep 2026, 15.31"', () => {
    expect(formatDateTime('2026-09-02T08:31:02.000Z', 'Asia/Jakarta')).toBe('2 Sep 2026, 15.31');
    expect(formatDateTime('2026-01-05T23:05:00.000Z', 'Asia/Jakarta')).toBe('6 Jan 2026, 06.05');
  });
});

describe('historyTone (SDD 7.7.13)', () => {
  it('memetakan status evaluasi ke varian penanda', () => {
    expect(historyTone({ evaluationStatus: null })).toBe('selesai');
    expect(historyTone({ evaluationStatus: 'EVALUATED' })).toBe('selesai');
    expect(historyTone({ evaluationStatus: 'FAILED' })).toBe('gagal');
    expect(historyTone({ evaluationStatus: 'PROCESSING' })).toBe('diproses');
    expect(historyTone({ evaluationStatus: 'SUBMITTED' })).toBe('diproses');
  });

  it('hanya Dengar-Pilih yang menaut ke detail percobaan', () => {
    expect(historyLink({ taskType: 'QUIZ', attemptId: 'att-1' })).toBe('/riwayat/att-1');
    expect(historyLink({ taskType: 'IMITATION', attemptId: 'sub-1' })).toBe('/riwayat/sub-1?jenis=tirukan');
  });
});

describe('grafik statistik (SDD 7.7.14)', () => {
  it('tidak tampil bila kurang dari dua titik', () => {
    expect(shouldShowChart([])).toBe(false);
    expect(shouldShowChart([1])).toBe(false);
    expect(shouldShowChart([1, 2])).toBe(true);
  });

  it('tren berupa teks', () => {
    expect(TREND_LABEL.UP).toBe('Naik');
    expect(TREND_LABEL.INSUFFICIENT_DATA).toBe('Belum cukup data');
  });
});
