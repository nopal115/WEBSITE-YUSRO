// SDD 5.18 (GET /admin/dashboard, GET /admin/dashboard/attention).

export interface EvaluationHealth {
  queued: number;
  processing: number;
  failedLast24h: number;
  /** [ASUMSI] SDD 5.18 hanya mencontohkan "ok"; health ML (SDD 8.11.3) mengenal "ok" dan "loading". */
  serviceStatus: string;
  modelVersion: string | null;
}

export interface AdminDashboard {
  totalStudents: number;
  activeStudents: number;
  /** Jumlah percobaan, bukan jumlah tugas (lihat komentar [TBD] di halaman). */
  attemptsTotal: number;
  /** [ASUMSI] null bila belum ada hasil valid (SDD hanya memberi contoh angka). */
  averageScore: number | null;
  averageProgressPct: number;
  evaluation: EvaluationHealth;
}

/** SDD 3.17.3 / FR-DASH-A-02. */
export type AttentionReason = 'LOW_PROGRESS' | 'SCORE_DECLINE' | 'NO_ATTEMPT';

/** Field pendukung hanya ada untuk alasan yang terpenuhi (contoh SDD 5.18). */
export interface AttentionItem {
  studentId: string;
  studentCode: string;
  name: string;
  /** [ASUMSI] Kode di luar tiga kriteria SDD ditampilkan "Perlu diperhatikan". */
  reasons: string[];
  learningProgressPct?: number;
  previousBest?: number;
  latestBest?: number;
  delta?: number;
  availableTasks?: number;
}
