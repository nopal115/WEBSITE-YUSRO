import type { FeedbackCategory } from '../../lib/api/types';
import type { QuizOption, QuizQuestion, QuizQuestionSnapshot, QuizSubmitResult, SubmitQuizInput } from './types';

// Alur SDD 3.9.4: jawab semua soal → ringkasan → kirim sekaligus → hasil. Tidak ada
// benar/salah sebelum pengiriman; kunci jawaban hanya datang dari respons submit.

export type QuizStep = { kind: 'question'; index: number } | { kind: 'summary' };

/** Jawaban santri: questionId → optionId. */
export type Answers = Record<string, string>;

export function sortQuestions<T extends { orderIndex: number }>(questions: T[]): T[] {
  return [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
}

export function allAnswered(questions: QuizQuestion[], answers: Answers): boolean {
  return questions.length > 0 && questions.every((question) => Boolean(answers[question.id]));
}

/** Soal berikutnya, atau ringkasan setelah soal terakhir. */
export function nextStep(step: QuizStep, total: number): QuizStep {
  if (step.kind !== 'question') return step;
  return step.index + 1 < total ? { kind: 'question', index: step.index + 1 } : { kind: 'summary' };
}

export function previousStep(step: QuizStep): QuizStep {
  if (step.kind !== 'question') return step;
  return { kind: 'question', index: Math.max(0, step.index - 1) };
}

/** Semua jawaban dalam satu pengiriman, urut sesuai soal (FR-QUIZ-04). */
export function buildSubmitInput(questions: QuizQuestion[], answers: Answers): SubmitQuizInput {
  return { answers: sortQuestions(questions).map((question) => ({ questionId: question.id, optionId: answers[question.id] })) };
}

export interface ResultRow {
  questionId: string;
  number: number;
  prompt: string;
  selected: QuizOption | undefined;
  correct: QuizOption | undefined;
  isCorrect: boolean;
}

/** Menggabungkan soal dengan rincian hasil dari server (SDD 7.7.9). */
export function mapResults(questions: QuizQuestionSnapshot[], result: Pick<QuizSubmitResult, 'results'>): ResultRow[] {
  return sortQuestions(questions).map((question, index) => {
    const row = result.results.find((item) => item.questionId === question.id);
    const option = (id: string | undefined) => question.options.find((item) => item.id === id);
    return {
      questionId: question.id,
      number: index + 1,
      prompt: question.prompt,
      selected: option(row?.selectedOptionId),
      correct: option(row?.correctOptionId),
      isCorrect: row?.isCorrect ?? false,
    };
  });
}

/** Label tampilan untuk feedbackCategory dari server (SRS FR-FEEDBACK-02); kategori tidak dihitung di klien. */
export const FEEDBACK_LABEL: Record<FeedbackCategory, string> = {
  SANGAT_BAIK: 'Sangat Baik',
  BAIK: 'Baik',
  CUKUP: 'Cukup',
  PERLU_LATIHAN: 'Perlu Latihan',
};
