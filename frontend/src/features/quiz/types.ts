import type { FeedbackCategory } from '../../lib/api/types';

// SDD 5.9. Kunci jawaban tidak pernah ada sebelum jawaban dikirim (SDD 3.7.4, 3.9.4).
export interface QuizOption {
  id: string;
  label: string;
  arabicLabel: string;
  orderIndex: number;
}

export interface QuizQuestion {
  id: string;
  orderIndex: number;
  prompt: string;
  audioUrl: string;
  options: QuizOption[];
}

export interface QuizTask {
  id: string;
  title: string;
  instruction: string;
  questionCount: number;
  attemptCount: number;
  bestScore: number | null;
  questions: QuizQuestion[];
}

export interface QuizAnswer {
  questionId: string;
  optionId: string;
}

/** Semua jawaban dikirim sekaligus (FR-QUIZ-04). */
export interface SubmitQuizInput {
  answers: QuizAnswer[];
}

export interface QuizQuestionResult {
  questionId: string;
  isCorrect: boolean;
  selectedOptionId: string;
  correctOptionId: string;
}

export interface QuizSubmitResult {
  attemptId: string;
  attemptNo: number;
  score: number;
  correctCount: number;
  questionCount: number;
  feedbackCategory: FeedbackCategory;
  results: QuizQuestionResult[];
  progress: { learningProgressPct: number; tasksCompleted: number };
}

/** Soal pada saat percobaan dikerjakan (tanpa audio dan tanpa kunci). */
export type QuizQuestionSnapshot = Pick<QuizQuestion, 'id' | 'orderIndex' | 'prompt' | 'options'>;

/**
 * [ASUMSI] GET /quiz/attempts/:id = data submit tanpa progress, ditambah taskId, submittedAt, dan
 * snapshot soal (prompt + options) sesuai SDD 5.9 ("diambil dari snapshot"). Kontrak baru yang
 * perlu disepakati dengan backend.
 */
export type QuizAttempt = Omit<QuizSubmitResult, 'progress'> & { taskId: string; submittedAt: string; questions: QuizQuestionSnapshot[] };
