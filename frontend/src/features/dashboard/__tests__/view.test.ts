import { describe, expect, it } from 'vitest';
import { dashboardCta, formatScore } from '../view';

describe('formatScore', () => {
  it('tanpa nol di belakang dan memakai desimal koma', () => {
    expect(formatScore(78)).toBe('78');
    expect(formatScore(78.0)).toBe('78');
    expect(formatScore(87.5)).toBe('87,5');
    expect(formatScore(77.78)).toBe('77,78');
  });
});

describe('dashboardCta (SDD 7.7.4)', () => {
  const lastMaterial = { id: 'mat-1', title: 'Materi 1', stageTitle: 'Tahapan 1' };

  it('melanjutkan ke continueTarget bila pernah membuka materi', () => {
    expect(dashboardCta({ lastMaterial, continueTarget: { materialId: 'mat-2' } })).toEqual({ kind: 'continue', materialId: 'mat-2' });
  });

  it('santri baru: MULAI BELAJAR ke materi pertama yang tersedia', () => {
    expect(dashboardCta({ lastMaterial: null, continueTarget: { materialId: 'mat-1' } })).toEqual({ kind: 'start', materialId: 'mat-1' });
  });

  it('semua materi selesai bila continueTarget null', () => {
    expect(dashboardCta({ lastMaterial, continueTarget: null })).toEqual({ kind: 'finished' });
  });
});
