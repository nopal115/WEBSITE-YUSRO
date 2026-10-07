import type { AccountStatus } from '../../auth/types';
import type { Progress } from '../../progress/types';

// SDD 5.14.

/** Butir daftar Santri (contoh SDD 5.14). */
export interface StudentListItem {
  id: string;
  studentCode: string;
  name: string;
  email: string;
  /** Judul tahapan tertinggi yang terbuka; null bila belum ada. */
  currentStage: string | null;
  learningProgressPct: number;
  /** [ASUMSI] null bila belum ada hasil valid (SDD hanya memberi contoh angka). */
  averageScore: number | null;
  status: AccountStatus;
  lastActivityAt: string | null;
}

/**
 * [ASUMSI] Bentuk GET /admin/students/:id tidak dirinci SDD 5.14: profil, tahapan tertinggi yang
 * terbuka, dan progress berbentuk sama dengan GET /progress sisi Santri (SDD 5.11).
 */
export interface StudentDetail {
  id: string;
  studentCode: string;
  name: string;
  email: string;
  status: AccountStatus;
  joinedAt: string;
  lastActivityAt: string | null;
  currentStage: { id: string; title: string } | null;
  progress: Progress;
}

/** PATCH /admin/students/:id/status (SDD 5.14). [ASUMSI] reason maksimal 255 karakter. */
export interface StudentStatusInput {
  status: AccountStatus;
  reason?: string;
}

/** [ASUMSI] Bentuk minimal GET /admin/stages untuk filter tahapan; SDD 5.15 tidak merinci respons. */
export interface StageOption {
  id: string;
  code: string;
  title: string;
  orderIndex: number;
  status: string;
}
