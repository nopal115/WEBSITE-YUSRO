import type { EvaluationStatus, FeedbackCategory } from '../../lib/api/types';

// SDD 5.10.

/**
 * Batasan rekaman dibaca dari respons API, tidak ditulis di kode.
 * Nilainya mengikuti SRS FR-IMITATE-06; contoh di SDD 5.10 (WAV, 2–60 detik, 10 MB) sudah usang.
 */
export interface ImitationConstraints {
  acceptedFormats: string[];
  minDurationMs: number;
  maxDurationMs: number;
  maxSizeBytes: number;
  cooldownSeconds: number;
}

export interface SubmissionPending {
  submissionId: string;
  evaluationStatus: Extract<EvaluationStatus, 'SUBMITTED' | 'PROCESSING'>;
  score: null;
  feedbackCategory: null;
  submittedAt: string;
  processingStartedAt?: string;
  elapsedMs: number;
}

export interface SubmissionEvaluated {
  submissionId: string;
  evaluationStatus: 'EVALUATED';
  score: number;
  feedbackCategory: FeedbackCategory;
  feedbackLabel: string;
  evaluatedAt: string;
  attemptNo: number;
  bestScore: number;
  progress: { learningProgressPct: number; tasksCompleted: number };
}

/** Skor FAILED selalu null, bukan 0 (NFR-REL-04). */
export interface SubmissionFailed {
  submissionId: string;
  evaluationStatus: 'FAILED';
  score: null;
  feedbackCategory: null;
  failedAt: string;
  userMessage: string;
  canResubmit: boolean;
}

export type SubmissionStatus = SubmissionPending | SubmissionEvaluated | SubmissionFailed;

export interface ImitationTask {
  id: string;
  title: string;
  instruction: string;
  referenceAudio: { id: string; url: string; durationMs: number };
  arabicText: string;
  constraints: ImitationConstraints;
  /** [ASUMSI] Bentuknya sama dengan respons status submission. */
  activeSubmission: SubmissionPending | null;
  attemptCount: number;
  bestScore: number | null;
}

export interface PollingStep {
  intervalMs: number;
  times: number;
}

/** Respons 202 Accepted: bukan hasil nilai; frontend memantau status sesuai jadwal polling. */
export interface SubmitRecordingResult {
  submissionId: string;
  attemptNo: number;
  evaluationStatus: 'SUBMITTED';
  score: null;
  submittedAt: string;
  polling: { recommendedSchedule: PollingStep[]; stopAfterMs: number };
}

/** [ASUMSI] Bentuk butir riwayat submission per tugas tidak dirinci SDD. */
export interface SubmissionHistoryItem {
  submissionId: string;
  attemptNo: number;
  evaluationStatus: EvaluationStatus;
  score: number | null;
  feedbackCategory: FeedbackCategory | null;
  submittedAt: string;
}
