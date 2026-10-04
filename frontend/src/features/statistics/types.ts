// SDD 5.12. Percobaan SUBMITTED, PROCESSING, dan FAILED tidak pernah ikut dihitung (BR-SCORE-04).
// [ASUMSI] Percobaan Dengar-Pilih ikut dihitung sebagai hasil valid pada statistik dan grafik (keputusan
// proyek). SDD 3.14.2 tidak tegas soal ini; perlu diperjelas di SDD dan disepakati dengan backend.
export interface Statistics {
  materialsCompleted: number;
  tasksCompleted: number;
  /** [ASUMSI] null bila belum ada hasil valid (SDD hanya memberi contoh angka). */
  averageScore: number | null;
  bestScore: number | null;
  learningProgressPct: number;
  evaluatedAttempts: number;
  failedAttempts: number;
}

export interface ChartPoint {
  sequence: number;
  attemptId: string;
  taskTitle: string;
  score: number;
  submittedAt: string;
}

export type ChartTrend = 'UP' | 'DOWN' | 'FLAT' | 'INSUFFICIENT_DATA';

export interface StatisticsChart {
  points: ChartPoint[];
  trend: ChartTrend;
}
