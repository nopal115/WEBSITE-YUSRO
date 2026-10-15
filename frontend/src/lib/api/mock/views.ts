// Bentuk respons per pengguna (SDD 5.11, 5.12) dari data mock yang sedang berjalan.
// Dipakai endpoint Santri dan endpoint Admin untuk akun Santri demo.
import type { HistoryItem, Progress } from '../../../features/progress/types';
import type { Statistics, StatisticsChart } from '../../../features/statistics/types';
import type { EvaluationStatus } from '../types';
import { CONTENT } from './data/content';
import { accessFor, activeMaterials, activeStages, completions, findMaterial, isTaskCompleted, progressSnapshot, quizAttemptsOf, submissionsOf, submissionStatus, tasksOf, validResults } from './db';
import { chartTrend, round2 } from './rules';

/** [ASUMSI] Label riwayat untuk SUBMITTED dan PROCESSING tidak dirinci SDD. */
export const DISPLAY_STATUS: Record<EvaluationStatus, string> = {
  SUBMITTED: 'Dikirim',
  PROCESSING: 'Sedang diproses',
  EVALUATED: 'Selesai',
  FAILED: 'Gagal diproses',
};

export const taskInfo = (taskId: string) => {
  const task = CONTENT.tasks.find((t) => t.id === taskId);
  return { taskTitle: task?.title ?? '', materialTitle: task ? findMaterial(task.materialId).title : '' };
};

export function progressView(userId: string): Progress {
  const snapshot = progressSnapshot(userId);
  const { stageAccess } = accessFor(userId);
  const done = completions(userId);
  return {
    learningProgressPct: snapshot.learningProgressPct,
    materials: { completed: snapshot.materialsCompleted, total: snapshot.materialsTotal, pct: snapshot.materialsPct },
    tasks: { completed: snapshot.tasksCompleted, total: snapshot.tasksTotal, pct: snapshot.tasksPct },
    // Hanya tahapan dan materi AKTIF (SDD 3.5.3).
    stages: activeStages().map((stage) => {
      // [ASUMSI] pct per tahapan = (materi + tugas selesai) / (materi + tugas) pada tahapan itu.
      const materials = activeMaterials().filter((m) => m.stageId === stage.id);
      const tasks = materials.flatMap((m) => tasksOf(m.id));
      const finished = materials.filter((m) => done.has(m.id)).length + tasks.filter((t) => isTaskCompleted(userId, t)).length;
      const total = materials.length + tasks.length;
      return { id: stage.id, title: stage.title, access: stageAccess.get(stage.id) ?? 'LOCKED', pct: total > 0 ? Math.round((finished / total) * 100) : 0 };
    }),
  };
}

/** Riwayat terbaru lebih dulu. */
export function historyItems(userId: string, now = Date.now()): HistoryItem[] {
  const quiz: HistoryItem[] = quizAttemptsOf(userId).map((a) => ({
    attemptId: a.id,
    taskId: a.taskId,
    ...taskInfo(a.taskId),
    taskType: 'QUIZ',
    attemptNo: a.attemptNo,
    score: a.score,
    evaluationStatus: null,
    displayStatus: 'Selesai',
    submittedAt: a.submittedAt,
  }));
  const imitation: HistoryItem[] = submissionsOf(userId).map((s) => {
    const status = submissionStatus(s, now);
    return {
      attemptId: s.id,
      taskId: s.taskId,
      ...taskInfo(s.taskId),
      taskType: 'IMITATION',
      attemptNo: s.attemptNo,
      score: status === 'EVALUATED' ? s.score : null,
      evaluationStatus: status,
      displayStatus: DISPLAY_STATUS[status],
      submittedAt: new Date(s.submittedAtMs).toISOString(),
    };
  });
  return [...quiz, ...imitation].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function statisticsView(userId: string, now = Date.now()): Statistics {
  const results = validResults(userId, now);
  // Nilai terbaik per tugas, lalu rata-ratanya (SDD 3.14.2).
  const best = new Map<string, number>();
  results.forEach((r) => best.set(r.taskId, Math.max(best.get(r.taskId) ?? 0, r.score)));
  const bests = [...best.values()];
  const snapshot = progressSnapshot(userId);
  return {
    materialsCompleted: snapshot.materialsCompleted,
    tasksCompleted: snapshot.tasksCompleted,
    averageScore: bests.length ? round2(bests.reduce((sum, value) => sum + value, 0) / bests.length) : null,
    bestScore: bests.length ? Math.max(...bests) : null,
    learningProgressPct: snapshot.learningProgressPct,
    evaluatedAttempts: results.length,
    failedAttempts: submissionsOf(userId).filter((s) => submissionStatus(s, now) === 'FAILED').length,
  };
}

export function chartView(userId: string): StatisticsChart {
  const points = validResults(userId).map((r, index) => ({
    sequence: index + 1,
    attemptId: r.attemptId,
    taskTitle: taskInfo(r.taskId).taskTitle,
    score: r.score,
    submittedAt: r.submittedAt,
  }));
  return { points, trend: chartTrend(points.map((p) => p.score)) };
}
