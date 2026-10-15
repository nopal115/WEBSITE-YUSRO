import { describe, expect, it } from 'vitest';
import { completionState, materialRow, stageBadge } from '../status';

describe('stageBadge (SDD 7.7.5)', () => {
  it('memetakan akses dan penyelesaian ke ikon + teks', () => {
    expect(stageBadge({ access: 'LOCKED', isCompleted: false }).label).toBe('Terkunci');
    expect(stageBadge({ access: 'LOCKED' }).label).toBe('Terkunci');
    expect(stageBadge({ access: 'UNLOCKED', isCompleted: true }).label).toBe('Selesai');
    expect(stageBadge({ access: 'UNLOCKED', isCompleted: false }).label).toBe('Terbuka');
  });
});

describe('materialRow (SDD 7.7.6)', () => {
  it('materi selesai tetap dapat dibuka dengan label "Pelajari ulang"', () => {
    expect(materialRow({ status: 'COMPLETED' })).toMatchObject({ canOpen: true, actionLabel: 'Pelajari ulang' });
  });

  it('materi tersedia dapat dibuka; materi terkunci tidak', () => {
    expect(materialRow({ status: 'AVAILABLE' }).canOpen).toBe(true);
    expect(materialRow({ status: 'LOCKED' })).toMatchObject({ canOpen: false, actionLabel: null });
  });
});

describe('completionState (SDD 7.7.7)', () => {
  it('nonaktif sampai akhir konten tercapai', () => {
    expect(completionState('AVAILABLE', false)).toBe('blocked');
    expect(completionState('AVAILABLE', true)).toBe('ready');
  });

  it('materi yang sudah selesai menampilkan penanda selesai', () => {
    expect(completionState('COMPLETED', false)).toBe('done');
    expect(completionState('COMPLETED', true)).toBe('done');
  });
});
