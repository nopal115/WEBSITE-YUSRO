// Endpoint Admin yang ditiru: dashboard (SDD 5.18), manajemen santri (SDD 5.14 + riwayat [ASUMSI]),
// dan daftar tahapan minimal (SDD 5.15). Endpoint admin lain belum ditiru (dijawab 404).
import type { AccountStatus } from '../../../../features/auth/types';
import { CONTENT } from '../data/content';
import { SAMPLE_EVALUATION } from '../data/students';
import { db, submissionStatus } from '../db';
import { fail, ok, paginate, type MockRequest } from '../http';
import { mockPdf } from '../media';
import type { MockRoute } from '../router';
import { attentionOf, round2 } from '../rules';
import {
  findStudentRecord,
  recordAverageScore,
  recordChart,
  recordHistory,
  recordLastActivity,
  recordProgress,
  recordStatistics,
  setStudentStatus,
  studentRecords,
  type StudentRecord,
} from '../students';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_REASON_LENGTH = 255;

function evaluationSummary(now = Date.now()) {
  const statuses = db.submissions.map((submission) => ({ status: submissionStatus(submission, now), submittedAtMs: submission.submittedAtMs }));
  return {
    ...SAMPLE_EVALUATION,
    queued: SAMPLE_EVALUATION.queued + statuses.filter((s) => s.status === 'SUBMITTED').length,
    processing: SAMPLE_EVALUATION.processing + statuses.filter((s) => s.status === 'PROCESSING').length,
    failedLast24h: SAMPLE_EVALUATION.failedLast24h + statuses.filter((s) => s.status === 'FAILED' && now - s.submittedAtMs < DAY_MS).length,
  };
}

/** Butir daftar Santri (contoh SDD 5.14) + data internal untuk penyaringan. */
function listRow(record: StudentRecord) {
  const stage = CONTENT.stages[record.highestStageIndex];
  return {
    item: {
      id: record.id,
      studentCode: record.studentCode,
      name: record.name,
      email: record.email,
      currentStage: stage?.title ?? null,
      learningProgressPct: record.activity.learningProgressPct,
      averageScore: recordAverageScore(record),
      status: record.status,
      lastActivityAt: recordLastActivity(record),
    },
    stageId: stage?.id ?? null,
  };
}

type Row = ReturnType<typeof listRow>;

const numberParam = (query: URLSearchParams, name: string): number | null => {
  const raw = query.get(name);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const SORTERS: Record<string, (a: Row, b: Row) => number> = {
  name: (a, b) => a.item.name.localeCompare(b.item.name, 'id'),
  progress: (a, b) => a.item.learningProgressPct - b.item.learningProgressPct,
  averageScore: (a, b) => (a.item.averageScore ?? -1) - (b.item.averageScore ?? -1),
  lastActivity: (a, b) => (a.item.lastActivityAt ?? '').localeCompare(b.item.lastActivityAt ?? ''),
};

/** Pencarian, penyaringan, dan pengurutan di "server" (SDD 3.16.4, NFR-PERF-04). */
function filterStudents(query: URLSearchParams): Row[] {
  const q = query.get('q')?.trim().toLowerCase() ?? '';
  const stageId = query.get('stageId');
  const status = query.get('status');
  const progressMin = numberParam(query, 'progressMin');
  const progressMax = numberParam(query, 'progressMax');
  const scoreMin = numberParam(query, 'scoreMin');
  const scoreMax = numberParam(query, 'scoreMax');

  const rows = studentRecords()
    .map(listRow)
    .filter(({ item, stageId: rowStage }) => {
      // Nama dan email: mengandung (ILIKE); ID Santri: cocok tepat (SDD 3.16.4).
      if (q && !item.name.toLowerCase().includes(q) && !item.email.toLowerCase().includes(q) && item.studentCode.toLowerCase() !== q) return false;
      if (stageId && rowStage !== stageId) return false;
      if (status && item.status !== status) return false;
      if (progressMin !== null && item.learningProgressPct < progressMin) return false;
      if (progressMax !== null && item.learningProgressPct > progressMax) return false;
      // Rentang nilai hanya cocok untuk santri yang sudah punya nilai.
      if ((scoreMin !== null || scoreMax !== null) && item.averageScore === null) return false;
      if (scoreMin !== null && (item.averageScore as number) < scoreMin) return false;
      if (scoreMax !== null && (item.averageScore as number) > scoreMax) return false;
      return true;
    });

  const [field, direction] = (query.get('sort') ?? 'name:asc').split(':');
  const sorter = SORTERS[field] ?? SORTERS.name;
  const sign = direction === 'desc' ? -1 : 1;
  // Nilai/aktivitas kosong selalu di akhir; urutan kedua berdasarkan nama.
  const isEmpty = (row: Row) => (field === 'averageScore' && row.item.averageScore === null) || (field === 'lastActivity' && row.item.lastActivityAt === null);
  return rows.sort((a, b) => Number(isEmpty(a)) - Number(isEmpty(b)) || sign * sorter(a, b) || SORTERS.name(a, b));
}

function pageQuery(query: URLSearchParams): URLSearchParams {
  const copy = new URLSearchParams(query);
  const limit = Number(copy.get('limit'));
  // Batas maksimum ditegakkan "backend" (SDD 3.16.3).
  if (limit > MAX_LIMIT) copy.set('limit', String(MAX_LIMIT));
  return copy;
}

function updateStatus(req: MockRequest) {
  const record = findStudentRecord(req.params.id);
  const body = (req.body ?? {}) as { status?: unknown; reason?: unknown };
  const errors: { field: string; message: string }[] = [];
  if (body.status !== 'ACTIVE' && body.status !== 'INACTIVE') errors.push({ field: 'status', message: 'Status harus ACTIVE atau INACTIVE.' });
  if (body.reason !== undefined && body.reason !== null && (typeof body.reason !== 'string' || body.reason.length > MAX_REASON_LENGTH)) {
    errors.push({ field: 'reason', message: `Alasan maksimal ${MAX_REASON_LENGTH} karakter.` });
  }
  if (errors.length > 0) return fail(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', errors);
  setStudentStatus(record.id, body.status as AccountStatus);
  // [ASUMSI] Respons berisi id dan status baru; frontend tidak membacanya.
  return ok({ id: record.id, status: body.status }, { message: body.status === 'INACTIVE' ? 'Akun santri dinonaktifkan.' : 'Akun santri diaktifkan kembali.' });
}

export const adminRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/admin/dashboard',
    access: 'ADMIN',
    handler: () => {
      const students = studentRecords();
      const bests = students.flatMap((s) => s.activity.taskBests.map((t) => t.bestScore));
      return ok({
        totalStudents: students.length,
        activeStudents: students.filter((s) => s.status === 'ACTIVE').length,
        attemptsTotal: students.reduce((sum, s) => sum + s.activity.attemptCount, 0),
        // [ASUMSI] Rumus mock: rata-rata seluruh nilai terbaik per tugas; null bila belum ada hasil valid.
        averageScore: bests.length > 0 ? round2(bests.reduce((sum, score) => sum + score, 0) / bests.length) : null,
        averageProgressPct: students.length > 0 ? Math.round(students.reduce((sum, s) => sum + s.activity.learningProgressPct, 0) / students.length) : 0,
        evaluation: evaluationSummary(),
      });
    },
  },
  {
    method: 'GET',
    pattern: '/admin/dashboard/attention',
    access: 'ADMIN',
    handler: () =>
      ok(
        studentRecords()
          // [ASUMSI] Hanya Santri aktif yang dipantau; SDD 3.17.3 tidak mengatur akun nonaktif.
          .filter((s) => s.status === 'ACTIVE')
          .map((s) => ({ studentId: s.id, studentCode: s.studentCode, name: s.name, ...attentionOf(s.activity) }))
          .filter((item) => item.reasons.length > 0),
      ),
  },
  {
    method: 'GET',
    pattern: '/admin/students',
    access: 'ADMIN',
    handler: (req) => {
      const { data, meta } = paginate(filterStudents(req.query).map((row) => row.item), pageQuery(req.query), DEFAULT_LIMIT);
      return ok(data, { meta });
    },
  },
  {
    method: 'GET',
    pattern: '/admin/students/:id',
    access: 'ADMIN',
    handler: (req) => {
      const record = findStudentRecord(req.params.id);
      const stage = CONTENT.stages[record.highestStageIndex];
      // [ASUMSI] Bentuk detail tidak dirinci SDD 5.14.
      return ok({
        id: record.id,
        studentCode: record.studentCode,
        name: record.name,
        email: record.email,
        status: record.status,
        joinedAt: record.joinedAt,
        lastActivityAt: recordLastActivity(record),
        currentStage: stage ? { id: stage.id, title: stage.title } : null,
        progress: recordProgress(record),
      });
    },
  },
  {
    method: 'PATCH',
    pattern: '/admin/students/:id/status',
    access: 'ADMIN',
    handler: updateStatus,
  },
  {
    method: 'GET',
    pattern: '/admin/students/:id/statistics',
    access: 'ADMIN',
    handler: (req) => ok(recordStatistics(findStudentRecord(req.params.id))),
  },
  {
    method: 'GET',
    pattern: '/admin/students/:id/chart',
    access: 'ADMIN',
    handler: (req) => ok(recordChart(findStudentRecord(req.params.id))),
  },
  {
    // [ASUMSI] Endpoint baru: bentuk sama dengan GET /progress/history.
    method: 'GET',
    pattern: '/admin/students/:id/history',
    access: 'ADMIN',
    handler: (req) => {
      const { data, meta } = paginate(recordHistory(findStudentRecord(req.params.id)), pageQuery(req.query), DEFAULT_LIMIT);
      return ok(data, { meta });
    },
  },
  {
    method: 'GET',
    pattern: '/admin/students/:id/report/pdf',
    access: 'ADMIN',
    handler: (req) => {
      const record = findStudentRecord(req.params.id);
      const date = new Date().toISOString().slice(0, 10);
      return {
        status: 200,
        blob: mockPdf(`Laporan Yusro [DATA CONTOH] - ${record.studentCode} - ${date}`),
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Laporan-${record.studentCode}-${date}.pdf"` },
      };
    },
  },
  {
    // [ASUMSI] Bentuk minimal untuk filter tahapan; SDD 5.15 tidak merinci respons.
    method: 'GET',
    pattern: '/admin/stages',
    access: 'ADMIN',
    handler: () => ok(CONTENT.stages.map((stage) => ({ id: stage.id, code: stage.code, title: stage.title, orderIndex: stage.orderIndex, status: 'ACTIVE' }))),
  },
];
