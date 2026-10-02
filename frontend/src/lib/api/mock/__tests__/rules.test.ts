import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { chartTrend, computeAccess, feedbackCategory, imitationStatusAt, quizScore } from '../rules';

describe('quizScore (FR-QUIZ-06)', () => {
  it('menghitung (benar / jumlah soal) × 100 dengan dua desimal', () => {
    expect(quizScore(7, 9)).toBe(77.78);
    expect(quizScore(4, 5)).toBe(80);
    expect(quizScore(0, 5)).toBe(0);
  });
});

describe('feedbackCategory (FR-FEEDBACK-02)', () => {
  it('memakai skor asli tanpa pembulatan', () => {
    expect(feedbackCategory(90)).toBe('SANGAT_BAIK');
    expect(feedbackCategory(89.5)).toBe('BAIK');
    expect(feedbackCategory(80)).toBe('BAIK');
    expect(feedbackCategory(79.99)).toBe('CUKUP');
    expect(feedbackCategory(69.99)).toBe('PERLU_LATIHAN');
  });
});

describe('computeAccess (SDD 3.8.3)', () => {
  const { stages, materials } = CONTENT;
  const stage1 = materials.filter((m) => m.stageId === 'stg-l001');

  it('awal: hanya materi pertama tahapan 1 yang terbuka', () => {
    const { stageAccess, materialStatus } = computeAccess(stages, materials, new Set());
    expect(stageAccess.get('stg-l001')).toBe('UNLOCKED');
    expect(stageAccess.get('stg-l002')).toBe('LOCKED');
    expect(materialStatus.get('mat-l001m001')).toBe('AVAILABLE');
    expect(materialStatus.get('mat-l001m002')).toBe('LOCKED');
    expect(materialStatus.get('mat-l002m001')).toBe('LOCKED');
  });

  it('materi terbuka berurutan dan materi selesai tetap terbuka', () => {
    const { materialStatus } = computeAccess(stages, materials, new Set(['mat-l001m001']));
    expect(materialStatus.get('mat-l001m001')).toBe('COMPLETED');
    expect(materialStatus.get('mat-l001m002')).toBe('AVAILABLE');
    expect(materialStatus.get('mat-l001m003')).toBe('LOCKED');
  });

  it('tahapan berikutnya terbuka setelah semua materi wajib tahapan sebelumnya selesai', () => {
    const almost = new Set(stage1.slice(0, -1).map((m) => m.id));
    expect(computeAccess(stages, materials, almost).stageAccess.get('stg-l002')).toBe('LOCKED');

    const all = new Set(stage1.map((m) => m.id));
    const { stageAccess, materialStatus } = computeAccess(stages, materials, all);
    expect(stageAccess.get('stg-l002')).toBe('UNLOCKED');
    expect(stageAccess.get('stg-l003')).toBe('LOCKED');
    expect(materialStatus.get('mat-l002m001')).toBe('AVAILABLE');
  });
});

describe('imitationStatusAt', () => {
  it('berpindah SUBMITTED → PROCESSING → hasil akhir seiring waktu', () => {
    expect(imitationStatusAt(0, 'EVALUATED', 1000)).toBe('SUBMITTED');
    expect(imitationStatusAt(0, 'EVALUATED', 5000)).toBe('PROCESSING');
    expect(imitationStatusAt(0, 'EVALUATED', 8000)).toBe('EVALUATED');
    expect(imitationStatusAt(0, 'FAILED', 8000)).toBe('FAILED');
  });
});

describe('chartTrend', () => {
  it('membandingkan tiga titik terakhir', () => {
    expect(chartTrend([70, 80])).toBe('INSUFFICIENT_DATA');
    expect(chartTrend([50, 70, 60, 80])).toBe('UP');
    expect(chartTrend([90, 70, 80])).toBe('DOWN');
    expect(chartTrend([80, 70, 80])).toBe('FLAT');
  });
});
