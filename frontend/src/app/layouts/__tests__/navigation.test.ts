import { describe, expect, it } from 'vitest';
import { isNavItemActive, NAV_ITEMS, TOP_NAV_ITEMS } from '../navigation';

describe('menu navbar Santri', () => {
  it('menu teks desktop berisi lima butir tanpa Profil', () => {
    expect(TOP_NAV_ITEMS.map((item) => item.label)).toEqual(['Beranda', 'Pembelajaran', 'Tugas', 'Progress', 'Riwayat']);
  });

  it('laci navigasi mobile tetap memuat Profil', () => {
    expect(NAV_ITEMS.map((item) => item.to)).toContain('/profil');
  });

  it('Progress tetap aktif di halaman Statistik', () => {
    const progress = TOP_NAV_ITEMS.find((item) => item.to === '/progress');
    expect(progress && isNavItemActive('/statistik', progress)).toBe(true);
  });
});
