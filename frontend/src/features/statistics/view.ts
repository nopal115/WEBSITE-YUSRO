import type { ChartTrend } from './types';

/** Grafik hanya tampil bila ada sekurang-kurangnya dua hasil evaluasi (SDD 7.7.14). */
export function shouldShowChart(points: readonly unknown[]): boolean {
  return points.length >= 2;
}

/** Tren ditampilkan sebagai teks, bukan warna saja (keputusan proyek, SDD 7.11). */
export const TREND_LABEL: Record<ChartTrend, string> = {
  UP: 'Naik',
  DOWN: 'Turun',
  FLAT: 'Stabil',
  INSUFFICIENT_DATA: 'Belum cukup data',
};
