import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { attentionOf, chartTrend, computeAccess, feedbackCategory, imitationStatusAt, quizScore, type StudentActivity } from '../rules';

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

describe('attentionOf (SDD 3.17.3, FR-DASH-A-02)', () => {
  const base: StudentActivity = { learningProgressPct: 80, availableTasks: 5, attemptCount: 3, taskBests: [] };
  const best = (taskId: string, bestScore: number, day: number) => ({ taskId, bestScore, lastAttemptAt: `2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z` });

  it('tidak ada alasan untuk santri yang baik-baik saja', () => {
    expect(attentionOf(base)).toEqual({ reasons: [] });
  });

  it('progress rendah bila kurang dari 50%', () => {
    expect(attentionOf({ ...base, learningProgressPct: 49 })).toEqual({ reasons: ['LOW_PROGRESS'], learningProgressPct: 49 });
    expect(attentionOf({ ...base, learningProgressPct: 50 }).reasons).toEqual([]);
  });

  it('nilai menurun: dua tugas terakhir menurut waktu, selisih sekurang-kurangnya 10 poin', () => {
    const declined = attentionOf({ ...base, taskBests: [best('t3', 71, 15), best('t1', 95, 1), best('t2', 88, 9)] });
    expect(declined).toEqual({ reasons: ['SCORE_DECLINE'], previousBest: 88, latestBest: 71, delta: -17 });
    expect(attentionOf({ ...base, taskBests: [best('t1', 80, 1), best('t2', 70, 2)] }).reasons).toEqual(['SCORE_DECLINE']);
    expect(attentionOf({ ...base, taskBests: [best('t1', 80, 1), best('t2', 70.01, 2)] }).reasons).toEqual([]);
    expect(attentionOf({ ...base, taskBests: [best('t1', 40, 1)] }).reasons).toEqual([]);
  });

  it('belum mengerjakan tugas bila tidak ada percobaan pada tugas yang tersedia', () => {
    expect(attentionOf({ ...base, attemptCount: 0 })).toEqual({ reasons: ['NO_ATTEMPT'], availableTasks: 5 });
    expect(attentionOf({ ...base, attemptCount: 0, availableTasks: 0 }).reasons).toEqual([]);
  });

  it('beberapa alasan sekaligus', () => {
    expect(attentionOf({ learningProgressPct: 18, availableTasks: 6, attemptCount: 0, taskBests: [] })).toEqual({
      reasons: ['LOW_PROGRESS', 'NO_ATTEMPT'],
      learningProgressPct: 18,
      availableTasks: 6,
    });
  });
});
