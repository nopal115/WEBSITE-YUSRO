import type { EvaluationStatus, FeedbackCategory, TaskType } from '../../../lib/api/types';

// SDD 5.18. Bentuk respons tidak dirinci SDD; semuanya [ASUMSI] dan dicatat di docs/api-contract.md.

/** [ASUMSI] Butir GET /admin/submissions, mengikuti bentuk status submission dan riwayat sisi Santri. */
export interface AdminSubmission {
  submissionId: string;
  attemptNo: number;
  studentId: string;
  studentCode: string;
  studentName: string;
  taskId: string;
  taskTitle: string;
  materialTitle: string;
  evaluationStatus: EvaluationStatus;
  /** null bila belum EVALUATED, termasuk FAILED (NFR-REL-04). */
  score: number | null;
  feedbackCategory: FeedbackCategory | null;
  submittedAt: string;
  evaluatedAt: string | null;
  failedAt: string | null;
}

/** [ASUMSI] GET /admin/submissions/:id: butir daftar + kode teknis kegagalan (hanya untuk Admin). */
export interface AdminSubmissionDetail extends AdminSubmission {
  errorCode: string | null;
}

/** [ASUMSI] URL rekaman berbatas waktu (SDD 3.17.4: 5 menit). */
export interface RecordingUrl {
  url: string;
  expiresInSeconds: number;
}

/** Respons 202 POST /admin/submissions/:id/retry (contoh SDD 5.18). */
export interface RetryResult {
  submissionId: string;
  evaluationStatus: 'SUBMITTED';
  attemptNo: number;
  jobId: string;
  isRetry: boolean;
}

/**
 * [ASUMSI] GET /admin/evaluation/queue: jumlah per status evaluasi (UI-ADMIN-MONITOR-02); EVALUATED dan
 * FAILED dihitung 24 jam terakhir. Backend-noval saat ini menghitung per status job (lihat api-contract).
 */
export interface EvaluationQueue {
  counts: Record<EvaluationStatus, number>;
  oldestWaitingSince: string | null;
}

/** [ASUMSI] GET /admin/evaluation/health (NFR-AVAIL-02); serviceStatus dipetakan dengan AS16. */
export interface ServiceHealth {
  serviceStatus: string;
  modelVersion: string | null;
  modelLoaded: boolean;
  checkedAt: string;
}

/** [ASUMSI] Bentuk minimal GET /admin/tasks untuk filter tugas; SDD 5.17 tidak merinci respons. */
export interface TaskOption {
  id: string;
  title: string;
  type: TaskType;
  materialTitle: string;
  status: string;
}
