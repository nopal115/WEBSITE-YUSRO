import { describe, expect, it } from 'vitest';
import { formatDateTime } from '../../../lib/utils/format';
import { shouldShowChart, TREND_LABEL } from '../../statistics/view';
import { historyLink, historyTone } from '../view';

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
    expect(historyLink({ taskType: 'IMITATION', attemptId: 'sub-1' })).toBeNull();
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
