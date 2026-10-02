// SDD 5.9 / 3.9: semua jawaban dikirim sekaligus; kunci hanya ada pada respons setelah dikirim.
import type { QuizQuestionResult } from '../../../../features/quiz/types';
import { assertMaterialOpen, attemptCount, bestScore, db, findTask, newId, progressSnapshot, quizAttemptsOf, type QuizAttemptRecord } from '../db';
import { fail, httpError, ok } from '../http';
import { mockAudioUrl } from '../media';
import type { MockRoute } from '../router';
import { feedbackCategory, quizScore } from '../rules';

function attemptView(attempt: QuizAttemptRecord) {
  return {
    attemptId: attempt.id,
    attemptNo: attempt.attemptNo,
    score: attempt.score,
    correctCount: attempt.correctCount,
    questionCount: attempt.questionCount,
    feedbackCategory: feedbackCategory(attempt.score),
    results: attempt.results,
  };
}

export const quizRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/quiz/tasks/:taskId',
    access: 'SANTRI',
    handler: (req) => {
      const userId = req.userId as string;
      const task = findTask(req.params.taskId, 'QUIZ');
      assertMaterialOpen(userId, task.materialId);
      return ok({
        id: task.id,
        title: task.title,
        instruction: task.instruction,
        questionCount: task.questions.length,
        attemptCount: attemptCount(userId, task),
        bestScore: bestScore(userId, task.id),
        // Tanpa correctOptionId (SDD 3.7.4).
        questions: task.questions.map(({ id, orderIndex, prompt, audioKey, options }) => ({
          id,
          orderIndex,
          prompt,
          audioUrl: mockAudioUrl(audioKey, 1200),
          options,
        })),
      });
    },
  },
  {
    method: 'POST',
    pattern: '/quiz/tasks/:taskId/submit',
    access: 'SANTRI',
    handler: (req) => {
      const userId = req.userId as string;
      const task = findTask(req.params.taskId, 'QUIZ');
      assertMaterialOpen(userId, task.materialId);
      const answers = (req.body as { answers?: unknown })?.answers;
      if (!Array.isArray(answers) || answers.length !== task.questions.length) {
        return fail(422, 'QUIZ_ANSWERS_INCOMPLETE', 'Jawab seluruh soal sebelum mengirim.');
      }
      const seen = new Set<string>();
      const results: QuizQuestionResult[] = answers.map((answer: { questionId?: unknown; optionId?: unknown }) => {
        const question = task.questions.find((q) => q.id === answer.questionId);
        const option = question?.options.find((o) => o.id === answer.optionId);
        if (!question || !option || seen.has(question.id)) {
          throw httpError(422, 'QUIZ_OPTION_MISMATCH', 'Pilihan jawaban tidak sesuai dengan soal.');
        }
        seen.add(question.id);
        return { questionId: question.id, isCorrect: option.id === question.correctOptionId, selectedOptionId: option.id, correctOptionId: question.correctOptionId };
      });
      const correctCount = results.filter((r) => r.isCorrect).length;
      const attempt: QuizAttemptRecord = {
        id: newId('att'),
        userId,
        taskId: task.id,
        attemptNo: quizAttemptsOf(userId, task.id).length + 1,
        score: quizScore(correctCount, task.questions.length),
        correctCount,
        questionCount: task.questions.length,
        results,
        submittedAt: new Date().toISOString(),
      };
      db.quizAttempts.push(attempt);
      const { learningProgressPct, tasksCompleted } = progressSnapshot(userId);
      return ok({ ...attemptView(attempt), progress: { learningProgressPct, tasksCompleted } }, { status: 201, message: 'Jawaban tersimpan.' });
    },
  },
  {
    method: 'GET',
    pattern: '/quiz/attempts/:attemptId',
    access: 'SANTRI',
    handler: (req) => {
      // Percobaan milik pengguna lain dijawab 404, bukan 403 (SDD 6.4.4).
      const attempt = db.quizAttempts.find((a) => a.id === req.params.attemptId && a.userId === req.userId);
      if (!attempt) return fail(404, 'NOT_FOUND', 'Data tidak ditemukan.');
      return ok({ ...attemptView(attempt), taskId: attempt.taskId, submittedAt: attempt.submittedAt });
    },
  },
];
