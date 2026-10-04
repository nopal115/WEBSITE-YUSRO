import { describe, expect, it } from 'vitest';
import { attentionDetails, reasonLabel, serviceStatusView } from '../view';

describe('reasonLabel', () => {
  it('tiga kriteria SDD 3.17.3 dan kode tak dikenal', () => {
    expect(reasonLabel('LOW_PROGRESS')).toBe('Progress rendah');
    expect(reasonLabel('SCORE_DECLINE')).toBe('Nilai menurun');
    expect(reasonLabel('NO_ATTEMPT')).toBe('Belum mengerjakan tugas');
    expect(reasonLabel('LAINNYA')).toBe('Perlu diperhatikan');
  });
});

describe('attentionDetails', () => {
  it('angka pendukung per alasan dengan format nilai Indonesia', () => {
    expect(attentionDetails({ studentId: 'a', studentCode: 'YSR-1', name: 'A', reasons: ['LOW_PROGRESS'], learningProgressPct: 22 })).toEqual(['Progress 22%']);
    expect(attentionDetails({ studentId: 'b', studentCode: 'YSR-2', name: 'B', reasons: ['SCORE_DECLINE'], previousBest: 79.5, latestBest: 62, delta: -17.5 })).toEqual(['Turun 17,5 poin (79,5 → 62)']);
    expect(attentionDetails({ studentId: 'c', studentCode: 'YSR-3', name: 'C', reasons: ['LOW_PROGRESS', 'NO_ATTEMPT'], learningProgressPct: 18, availableTasks: 6 })).toEqual(['Progress 18%', '6 tugas tersedia']);
  });

  it('tanpa field pendukung tidak menampilkan apa-apa', () => {
    expect(attentionDetails({ studentId: 'd', studentCode: 'YSR-4', name: 'D', reasons: ['SCORE_DECLINE'] })).toEqual([]);
  });
});

describe('serviceStatusView', () => {
  it('memetakan status layanan evaluasi', () => {
    expect(serviceStatusView('ok')).toEqual({ tone: 'ok', label: 'Berjalan normal' });
    expect(serviceStatusView('loading')).toEqual({ tone: 'loading', label: 'Sedang memuat model' });
    expect(serviceStatusView('down')).toEqual({ tone: 'down', label: 'Terganggu' });
    expect(serviceStatusView(undefined)).toEqual({ tone: 'down', label: 'Terganggu' });
  });
});
