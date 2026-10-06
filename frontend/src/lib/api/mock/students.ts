// Santri untuk endpoint Admin (SDD 5.14, 5.18): [DATA CONTOH] santri contoh + akun Santri demo.
// Data turunan santri contoh (riwayat, statistik, grafik, progress) dibangkitkan deterministik dari
// ringkasan aktivitasnya; data akun demo dihitung dari data mock yang sedang berjalan.
import type { AccountStatus } from '../../../features/auth/types';
import type { HistoryItem, Progress } from '../../../features/progress/types';
import type { Statistics, StatisticsChart } from '../../../features/statistics/types';
import { CONTENT } from './data/content';
import { accessFor, db, progressSnapshot, quizAttemptsOf, submissionsOf, validResults } from './db';
import { httpError } from './http';
import { chartTrend, round2, type StudentActivity } from './rules';
import { chartView, historyItems, progressView, statisticsView, taskInfo } from './views';

export interface StudentRecord {
  id: string;
  studentCode: string;
  name: string;
  email: string;
  status: AccountStatus;
  joinedAt: string;
  highestStageIndex: number;
  activity: StudentActivity;
  live: boolean;
}

/** Aktivitas akun demo dari data mock yang sedang berjalan. */
function liveActivity(userId: string): StudentActivity {
  const { materialStatus } = accessFor(userId);
  const availableTasks = CONTENT.tasks.filter((task) => materialStatus.get(task.materialId) !== 'LOCKED').length;
  const bests = new Map<string, { taskId: string; bestScore: number; lastAttemptAt: string }>();
  for (const result of validResults(userId)) {
    const current = bests.get(result.taskId);
    bests.set(result.taskId, {
      taskId: result.taskId,
      bestScore: Math.max(current?.bestScore ?? 0, result.score),
      lastAttemptAt: current && current.lastAttemptAt > result.submittedAt ? current.lastAttemptAt : result.submittedAt,
    });
  }
  return {
    learningProgressPct: progressSnapshot(userId).learningProgressPct,
    availableTasks,
    attemptCount: quizAttemptsOf(userId).length + submissionsOf(userId).length,
    taskBests: [...bests.values()],
  };
}

function liveHighestStage(userId: string): number {
  const { stageAccess } = accessFor(userId);
  return CONTENT.stages.reduce((highest, stage, index) => (stageAccess.get(stage.id) === 'UNLOCKED' ? index : highest), 0);
}

/** Seluruh Santri: santri contoh ditambah akun Santri demo. */
export function studentRecords(): StudentRecord[] {
  const live = db.users
    .filter((user) => user.role === 'SANTRI')
    .map((user) => ({
      id: user.id,
      studentCode: user.studentCode ?? '',
      name: user.name,
      email: user.email,
      status: user.status,
      joinedAt: user.joinedAt,
      highestStageIndex: liveHighestStage(user.id),
      activity: liveActivity(user.id),
      live: true,
    }));
  return [...db.sampleStudents.map((item) => ({ ...item, live: false })), ...live];
}

export function findStudentRecord(id: string): StudentRecord {
  const record = studentRecords().find((item) => item.id === id);
  if (!record) throw httpError(404, 'NOT_FOUND', 'Data tidak ditemukan.');
  return record;
}

/** Status akun disimpan di tempat asalnya (db.users untuk akun demo, db.sampleStudents untuk contoh). */
export function setStudentStatus(id: string, status: AccountStatus): void {
  const user = db.users.find((item) => item.id === id && item.role === 'SANTRI');
  if (user) {
    user.status = status;
    return;
  }
  const sample = db.sampleStudents.find((item) => item.id === id);
  if (!sample) throw httpError(404, 'NOT_FOUND', 'Data tidak ditemukan.');
  sample.status = status;
}

/** Tugas pada tahapan yang terbuka, urut tahapan lalu materi. */
function openTasks(highestStageIndex: number) {
  const openStages = new Set(CONTENT.stages.slice(0, highestStageIndex + 1).map((stage) => stage.id));
  const openMaterials = new Set(CONTENT.materials.filter((material) => openStages.has(material.stageId)).map((material) => material.id));
  return CONTENT.tasks.filter((task) => openMaterials.has(task.materialId));
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * [DATA CONTOH] Riwayat santri contoh: jumlah percobaan = attemptCount, nilai terbaik per tugas =
 * taskBests (percobaan terbaik pada lastAttemptAt), percobaan lain bernilai lebih rendah dan lebih awal.
 */
function sampleHistory(record: StudentRecord): HistoryItem[] {
  const bests = [...record.activity.taskBests].sort((a, b) => a.lastAttemptAt.localeCompare(b.lastAttemptAt));
  const tasks = openTasks(record.highestStageIndex);
  if (bests.length === 0 || tasks.length === 0) return [];
  const raw: { taskIndex: number; score: number; atMs: number }[] = bests.map((best, index) => ({ taskIndex: index, score: best.bestScore, atMs: Date.parse(best.lastAttemptAt) }));
  const extra = Math.max(0, record.activity.attemptCount - bests.length);
  for (let k = 0; k < extra; k += 1) {
    const index = k % bests.length;
    const round = 1 + Math.floor(k / bests.length);
    raw.push({ taskIndex: index, score: Math.max(0, bests[index].bestScore - 5 * round), atMs: Date.parse(bests[index].lastAttemptAt) - round * 6 * HOUR_MS });
  }
  raw.sort((a, b) => a.atMs - b.atMs);
  const attemptNo = new Map<number, number>();
  const items = raw.map((entry, index): HistoryItem => {
    const task = tasks[entry.taskIndex % tasks.length];
    const no = (attemptNo.get(entry.taskIndex) ?? 0) + 1;
    attemptNo.set(entry.taskIndex, no);
    return {
      attemptId: `${record.id}-a${index + 1}`,
      taskId: task.id,
      ...taskInfo(task.id),
      taskType: task.type,
      attemptNo: no,
      score: entry.score,
      evaluationStatus: task.type === 'QUIZ' ? null : 'EVALUATED',
      displayStatus: 'Selesai',
      submittedAt: new Date(entry.atMs).toISOString(),
    };
  });
  return items.reverse();
}

export function recordHistory(record: StudentRecord): HistoryItem[] {
  return record.live ? historyItems(record.id) : sampleHistory(record);
}

const bestAverage = (record: StudentRecord): number | null => {
  const bests = record.activity.taskBests.map((item) => item.bestScore);
  return bests.length > 0 ? round2(bests.reduce((sum, score) => sum + score, 0) / bests.length) : null;
};

/** [DATA CONTOH] Progress santri contoh diturunkan dari persentase dan tahapan tertingginya. */
export function recordProgress(record: StudentRecord): Progress {
  if (record.live) return progressView(record.id);
  const pct = record.activity.learningProgressPct;
  const openStages = CONTENT.stages.slice(0, record.highestStageIndex + 1).map((stage) => stage.id);
  const materialsTotal = CONTENT.materials.filter((material) => openStages.includes(material.stageId)).length;
  const tasksTotal = openTasks(record.highestStageIndex).length;
  const ratio = (total: number) => {
    const completed = Math.round((total * pct) / 100);
    return { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };
  return {
    learningProgressPct: pct,
    materials: ratio(materialsTotal),
    tasks: ratio(tasksTotal),
    stages: CONTENT.stages.map((stage, index) => ({
      id: stage.id,
      title: stage.title,
      access: index <= record.highestStageIndex ? 'UNLOCKED' : 'LOCKED',
      pct: index < record.highestStageIndex ? 100 : index === record.highestStageIndex ? pct : 0,
    })),
  };
}

export function recordStatistics(record: StudentRecord): Statistics {
  if (record.live) return statisticsView(record.id);
  const progress = recordProgress(record);
  const bests = record.activity.taskBests.map((item) => item.bestScore);
  return {
    materialsCompleted: progress.materials.completed,
    tasksCompleted: progress.tasks.completed,
    averageScore: bestAverage(record),
    bestScore: bests.length > 0 ? Math.max(...bests) : null,
    learningProgressPct: progress.learningProgressPct,
    evaluatedAttempts: sampleHistory(record).length,
    failedAttempts: 0,
  };
}

export function recordChart(record: StudentRecord): StatisticsChart {
  if (record.live) return chartView(record.id);
  const points = sampleHistory(record)
    .slice()
    .reverse()
    .map((item, index) => ({ sequence: index + 1, attemptId: item.attemptId, taskTitle: item.taskTitle, score: item.score as number, submittedAt: item.submittedAt }));
  return { points, trend: chartTrend(points.map((point) => point.score)) };
}

/** Rata-rata nilai daftar santri: rata-rata nilai terbaik per tugas (SDD 3.14.2); null bila belum ada. */
export function recordAverageScore(record: StudentRecord): number | null {
  return record.live ? statisticsView(record.id).averageScore : bestAverage(record);
}

export function recordLastActivity(record: StudentRecord): string | null {
  return recordHistory(record)[0]?.submittedAt ?? null;
}
