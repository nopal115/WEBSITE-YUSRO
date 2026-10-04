// State tiruan di memori; hilang saat halaman dimuat ulang.
import type { AccountStatus, UserRole } from '../../../features/auth/types';
import type { QuizQuestionResult } from '../../../features/quiz/types';
import type { EvaluationStatus } from '../types';
import { CONTENT, type MockImitationTask, type MockMaterial, type MockQuizTask, type MockStage, type MockTask } from './data/content';
import { httpError } from './http';
import { computeAccess, imitationStatusAt, type AccessState } from './rules';

export interface MockUser {
  id: string;
  studentCode: string | null;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: AccountStatus;
  joinedAt: string;
}

export interface QuizAttemptRecord {
  id: string;
  userId: string;
  taskId: string;
  attemptNo: number;
  score: number;
  correctCount: number;
  questionCount: number;
  results: QuizQuestionResult[];
  submittedAt: string;
}

export interface SubmissionRecord {
  id: string;
  userId: string;
  taskId: string;
  attemptNo: number;
  submittedAtMs: number;
  idempotencyKey: string | null;
  outcome: 'EVALUATED' | 'FAILED';
  /** Skor yang akan muncul bila EVALUATED; selalu null untuk FAILED. */
  score: number | null;
}

/** Akun contoh, hanya ada di mode mock. */
function seedUsers(): MockUser[] {
  return [
    { id: 'usr-santri', studentCode: 'YSR-000001', name: 'Santri Contoh', email: 'santri@yusro.mock', password: 'santri123', role: 'SANTRI', status: 'ACTIVE', joinedAt: '2026-09-01T00:00:00.000Z' },
    { id: 'usr-admin', studentCode: null, name: 'Admin Contoh', email: 'admin@yusro.mock', password: 'admin1234', role: 'ADMIN', status: 'ACTIVE', joinedAt: '2026-09-01T00:00:00.000Z' },
  ];
}

export const db = {
  users: seedUsers(),
  materialCompletions: new Map<string, Map<string, string>>(),
  lastOpened: new Map<string, string>(),
  quizAttempts: [] as QuizAttemptRecord[],
  submissions: [] as SubmissionRecord[],
};

export function resetDb(): void {
  db.users = seedUsers();
  db.materialCompletions.clear();
  db.lastOpened.clear();
  db.quizAttempts = [];
  db.submissions = [];
}

export const newId = (prefix: string): string => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export function findUser(userId: string | null): MockUser {
  const user = db.users.find((item) => item.id === userId);
  if (!user) throw httpError(401, 'AUTH_TOKEN_EXPIRED', 'Sesi berakhir. Silakan masuk kembali.');
  return user;
}

const NOT_FOUND = () => httpError(404, 'NOT_FOUND', 'Data tidak ditemukan.');

export function findStage(id: string): MockStage {
  const stage = CONTENT.stages.find((item) => item.id === id);
  if (!stage) throw NOT_FOUND();
  return stage;
}

export function findMaterial(id: string): MockMaterial {
  const material = CONTENT.materials.find((item) => item.id === id);
  if (!material) throw NOT_FOUND();
  return material;
}

export function findTask<T extends MockTask['type']>(id: string, type: T): Extract<MockTask, { type: T }> {
  const task = CONTENT.tasks.find((item) => item.id === id && item.type === type);
  if (!task) throw NOT_FOUND();
  return task as Extract<MockTask, { type: T }>;
}

export const tasksOf = (materialId: string): MockTask[] => CONTENT.tasks.filter((task) => task.materialId === materialId);

export function completions(userId: string): Map<string, string> {
  let map = db.materialCompletions.get(userId);
  if (!map) {
    map = new Map();
    db.materialCompletions.set(userId, map);
  }
  return map;
}

export function accessFor(userId: string): AccessState {
  return computeAccess(CONTENT.stages, CONTENT.materials, new Set(completions(userId).keys()));
}

/** SDD 3.8.6: tugas dan materi terkunci ditolak dengan 403. */
export function assertMaterialOpen(userId: string, materialId: string): void {
  if (accessFor(userId).materialStatus.get(materialId) === 'LOCKED') {
    throw httpError(403, 'LEARNING_MATERIAL_LOCKED', 'Materi ini belum terbuka. Selesaikan materi sebelumnya.');
  }
}

export const quizAttemptsOf = (userId: string, taskId?: string) =>
  db.quizAttempts.filter((a) => a.userId === userId && (!taskId || a.taskId === taskId));

export const submissionsOf = (userId: string, taskId?: string) =>
  db.submissions.filter((s) => s.userId === userId && (!taskId || s.taskId === taskId));

export const submissionStatus = (submission: SubmissionRecord, now = Date.now()): EvaluationStatus =>
  imitationStatusAt(submission.submittedAtMs, submission.outcome, now);

/** SDD 3.13.3: QUIZ selesai bila ada percobaan; IMITATION selesai bila ada submission, apa pun statusnya. */
export function isTaskCompleted(userId: string, task: MockTask): boolean {
  return task.type === 'QUIZ' ? quizAttemptsOf(userId, task.id).length > 0 : submissionsOf(userId, task.id).length > 0;
}

export interface ValidResult {
  attemptId: string;
  taskId: string;
  score: number;
  submittedAt: string;
}

/**
 * Hasil valid untuk statistik dan grafik (SDD 3.14.2): percobaan Dengar-Pilih dan submission EVALUATED.
 * [ASUMSI] Percobaan Dengar-Pilih selalu dihitung sebagai hasil valid (keputusan proyek). SDD 3.14.2
 * tidak tegas: rumusnya mensyaratkan evaluation_status = EVALUATED, padahal percobaan Dengar-Pilih
 * ber-evaluationStatus null (SDD 5.11). Perlu diperjelas di SDD dan disepakati dengan backend.
 */
export function validResults(userId: string, now = Date.now()): ValidResult[] {
  const quiz = quizAttemptsOf(userId).map((a) => ({ attemptId: a.id, taskId: a.taskId, score: a.score, submittedAt: a.submittedAt }));
  const imitation = submissionsOf(userId)
    .filter((s) => submissionStatus(s, now) === 'EVALUATED' && s.score !== null)
    .map((s) => ({ attemptId: s.id, taskId: s.taskId, score: s.score as number, submittedAt: new Date(s.submittedAtMs).toISOString() }));
  return [...quiz, ...imitation].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

export function bestScore(userId: string, taskId: string): number | null {
  const scores = validResults(userId).filter((r) => r.taskId === taskId).map((r) => r.score);
  return scores.length ? Math.max(...scores) : null;
}

export function attemptCount(userId: string, task: MockTask): number {
  return task.type === 'QUIZ' ? quizAttemptsOf(userId, task.id).length : submissionsOf(userId, task.id).length;
}

/**
 * SDD 3.13.2: progress pembelajaran = (materi selesai + tugas selesai) / (total materi + total tugas),
 * dengan penyebut materi dan tugas pada tahapan yang telah terbuka.
 */
export function progressSnapshot(userId: string) {
  const { stageAccess } = accessFor(userId);
  const done = completions(userId);
  const materials = CONTENT.materials.filter((m) => stageAccess.get(m.stageId) === 'UNLOCKED');
  const tasks = materials.flatMap((m) => tasksOf(m.id));
  const materialsCompleted = materials.filter((m) => done.has(m.id)).length;
  const tasksCompleted = tasks.filter((t) => isTaskCompleted(userId, t)).length;
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
  return {
    learningProgressPct: pct(materialsCompleted + tasksCompleted, materials.length + tasks.length),
    materialsCompleted,
    materialsTotal: materials.length,
    tasksCompleted,
    tasksTotal: tasks.length,
    materialsPct: pct(materialsCompleted, materials.length),
    tasksPct: pct(tasksCompleted, tasks.length),
  };
}

export type { MockImitationTask, MockQuizTask };
