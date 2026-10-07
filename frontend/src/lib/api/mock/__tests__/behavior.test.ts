import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockControls } from '../controls';
import { CONTENT, type MockQuizTask } from '../data/content';
import { formatDateStamp } from '../../../utils/format';
import { resetDb } from '../db';
import { resolveIdentity, routes } from '../handlers';
import { createMockFetch } from '../router';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const mockFetch = createMockFetch(routes, resolveIdentity);
let token = '';

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const response = await mockFetch(method, path, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function login(email: string, password: string) {
  token = '';
  const { body } = await call('POST', 'auth/login', { email, password });
  token = body.data?.accessToken ?? '';
  return body;
}

function recording(type = 'audio/webm;codecs=opus', bytes = 1000): FormData {
  const form = new FormData();
  form.append('audio_file', new Blob([new Uint8Array(bytes)], { type }));
  return form;
}

beforeEach(async () => {
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-02T08:00:00.000Z'));
  resetDb();
  mockControls.reset();
  mockControls.setDelay(0);
  await login('santri@yusro.mock', 'santri123');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('auth tiruan', () => {
  it('login dengan akun contoh dan membaca /auth/me', async () => {
    const me = await call('GET', 'auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ email: 'santri@yusro.mock', role: 'SANTRI', studentCode: 'YSR-000001' });
  });

  it('kredensial salah dijawab 401 AUTH_INVALID_CREDENTIALS', async () => {
    const body = await login('santri@yusro.mock', 'salah');
    expect(body).toMatchObject({ success: false, errorCode: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('logout membatalkan token', async () => {
    await call('POST', 'auth/logout');
    expect((await call('GET', 'auth/me')).status).toBe(401);
  });

  it('akun ADMIN ditolak di endpoint Santri', async () => {
    await login('admin@yusro.mock', 'admin1234');
    expect((await call('GET', 'learning/stages')).status).toBe(403);
  });
});

describe('buka-kunci materi (SDD 3.8.3, 3.8.4)', () => {
  it('menolak materi dan tahapan yang terkunci', async () => {
    expect((await call('POST', 'learning/materials/mat-l001m002/complete')).body.errorCode).toBe('LEARNING_MATERIAL_LOCKED');
    expect((await call('GET', 'learning/stages/stg-l002/materials')).body.errorCode).toBe('LEARNING_STAGE_LOCKED');
  });

  it('menyelesaikan seluruh materi tahapan 1 membuka tahapan 2, dan penyelesaian bersifat idempoten', async () => {
    const stage1 = CONTENT.materials.filter((m) => m.stageId === 'stg-l001');
    let last;
    for (const material of stage1) last = await call('POST', `learning/materials/${material.id}/complete`);
    expect(last?.body.data.stageUnlocked).toMatchObject({ id: 'stg-l002', code: 'l002' });

    const again = await call('POST', 'learning/materials/mat-l001m001/complete');
    expect(again.status).toBe(200);
    expect(again.body.data.stageUnlocked).toBeNull();

    const stages = (await call('GET', 'learning/stages')).body.data;
    expect(stages[1]).toMatchObject({ access: 'UNLOCKED' });
    expect(stages[2]).toMatchObject({ access: 'LOCKED' });
  });
});

describe('quiz (SDD 3.9)', () => {
  const task = CONTENT.tasks.find((t) => t.id === 'tsk-l001m001-quiz') as MockQuizTask;

  it('tidak membocorkan kunci sebelum dikirim', async () => {
    const { body } = await call('GET', `quiz/tasks/${task.id}`);
    expect(body.data.questions).toHaveLength(5);
    expect(JSON.stringify(body.data)).not.toContain('correctOptionId');
  });

  it('menghitung nilai sesuai FR-QUIZ-06 dan mengembalikan hasil per soal setelah dikirim', async () => {
    const answers = task.questions.map((q, i) => ({
      questionId: q.id,
      optionId: i < 4 ? q.correctOptionId : q.options.find((o) => o.id !== q.correctOptionId)?.id,
    }));
    const { status, body } = await call('POST', `quiz/tasks/${task.id}/submit`, { answers });
    expect(status).toBe(201);
    expect(body.data).toMatchObject({ score: 80, correctCount: 4, questionCount: 5, feedbackCategory: 'BAIK', attemptNo: 1 });
    expect(body.data.results[4]).toMatchObject({ isCorrect: false, correctOptionId: task.questions[4].correctOptionId });

    const attempt = await call('GET', `quiz/attempts/${body.data.attemptId}`);
    expect(attempt.body.data).toMatchObject({ score: 80, taskId: task.id });
  });

  it('menolak jawaban yang tidak lengkap', async () => {
    const { status, body } = await call('POST', `quiz/tasks/${task.id}/submit`, { answers: [] });
    expect(status).toBe(422);
    expect(body.errorCode).toBe('QUIZ_ANSWERS_INCOMPLETE');
  });
});

describe('imitation (SDD 3.10, 5.10)', () => {
  const taskId = 'tsk-l001m001-imitation';
  const submit = (headers: Record<string, string> = {}) => call('POST', `imitation/tasks/${taskId}/submissions`, recording(), headers);
  const advance = (ms: number) => vi.setSystemTime(Date.now() + ms);

  it('menyajikan constraints dari SRS FR-IMITATE-06', async () => {
    const { body } = await call('GET', `imitation/tasks/${taskId}`);
    expect(body.data.constraints).toEqual({
      acceptedFormats: ['audio/webm;codecs=opus', 'audio/mp4'],
      minDurationMs: 1000,
      maxDurationMs: 30000,
      maxSizeBytes: 5242880,
      cooldownSeconds: 10,
    });
  });

  it('status berpindah SUBMITTED → PROCESSING → EVALUATED; 409 saat aktif, 429 dalam jeda', async () => {
    const first = await submit();
    expect(first.status).toBe(202);
    const id = first.body.data.submissionId;
    expect((await call('GET', `imitation/submissions/${id}`)).body.data.evaluationStatus).toBe('SUBMITTED');

    expect((await submit()).body.errorCode).toBe('IMITATION_ACTIVE_EXISTS');

    advance(3000);
    expect((await call('GET', `imitation/submissions/${id}`)).body.data.evaluationStatus).toBe('PROCESSING');

    advance(6000); // 9 detik setelah kirim: sudah dievaluasi, tetapi masih dalam jeda 10 detik
    const evaluated = (await call('GET', `imitation/submissions/${id}`)).body.data;
    expect(evaluated).toMatchObject({ evaluationStatus: 'EVALUATED', attemptNo: 1 });
    expect(typeof evaluated.score).toBe('number');
    expect((await submit()).body.errorCode).toBe('IMITATION_COOLDOWN');

    advance(2000);
    expect((await submit()).status).toBe(202);
  });

  it('FAILED selalu ber-score null, bukan 0', async () => {
    mockControls.nextEvaluation('FAILED');
    const id = (await submit()).body.data.submissionId;
    advance(8000);
    const { body } = await call('GET', `imitation/submissions/${id}`);
    expect(body.data).toMatchObject({ evaluationStatus: 'FAILED', score: null, canResubmit: true });
  });

  it('Idempotency-Key yang sama mengembalikan submission yang sama', async () => {
    const a = await submit({ 'Idempotency-Key': 'kunci-1' });
    const b = await submit({ 'Idempotency-Key': 'kunci-1' });
    expect(b.status).toBe(202);
    expect(b.body.data.submissionId).toBe(a.body.data.submissionId);
  });

  it('menolak format dan ukuran di luar constraints', async () => {
    const wav = await call('POST', `imitation/tasks/${taskId}/submissions`, recording('audio/wav'));
    expect(wav).toMatchObject({ status: 422, body: { errorCode: 'AUDIO_FORMAT_UNSUPPORTED' } });
    const big = await call('POST', `imitation/tasks/${taskId}/submissions`, recording('audio/mp4', 5242881));
    expect(big).toMatchObject({ status: 413, body: { errorCode: 'AUDIO_TOO_LARGE', message: 'Ukuran rekaman melebihi 5 MB.' } });
  });
});

describe('admin dashboard (SDD 5.18)', () => {
  it('Santri ditolak 403 di endpoint Admin', async () => {
    expect(await call('GET', 'admin/dashboard')).toMatchObject({ status: 403, body: { errorCode: 'FORBIDDEN_ROLE' } });
    expect((await call('GET', 'admin/dashboard/attention')).status).toBe(403);
  });

  it('ringkasan dan daftar perhatian untuk Admin', async () => {
    await login('admin@yusro.mock', 'admin1234');
    const dashboard = await call('GET', 'admin/dashboard');
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data).toMatchObject({ totalStudents: 48, activeStudents: 41, evaluation: { serviceStatus: 'ok', modelVersion: expect.any(String) } });
    expect(typeof dashboard.body.data.averageScore).toBe('number');

    const attention = await call('GET', 'admin/dashboard/attention');
    const byCode = Object.fromEntries(attention.body.data.map((item: { studentCode: string; reasons: string[] }) => [item.studentCode, item.reasons]));
    expect(byCode['YSR-000102']).toEqual(['LOW_PROGRESS']);
    expect(byCode['YSR-000103']).toEqual(['SCORE_DECLINE']);
    expect(byCode['YSR-000104']).toEqual(['LOW_PROGRESS', 'NO_ATTEMPT']);
    expect(byCode['YSR-000106']).toEqual(['LOW_PROGRESS', 'SCORE_DECLINE']);
    // Turun 8 poin (di bawah ambang) dan akun nonaktif tidak masuk daftar.
    expect(byCode['YSR-000107']).toBeUndefined();
    expect(byCode['YSR-000109']).toBeUndefined();
    // Akun demo baru: progress 0% dan belum ada percobaan.
    expect(byCode['YSR-000001']).toEqual(['LOW_PROGRESS', 'NO_ATTEMPT']);
  });
});

describe('admin santri (SDD 5.14, 3.16)', () => {
  type Row = { id: string; studentCode: string; name: string; email: string; currentStage: string | null; learningProgressPct: number; averageScore: number | null; status: string };
  const list = async (query: string) => {
    const response = await call('GET', `admin/students?${query}`);
    return { rows: response.body.data as Row[], meta: response.body.meta, status: response.status };
  };

  beforeEach(async () => {
    await login('admin@yusro.mock', 'admin1234');
  });

  it('Santri ditolak 403', async () => {
    await login('santri@yusro.mock', 'santri123');
    expect((await call('GET', 'admin/students')).status).toBe(403);
    expect((await call('GET', 'admin/stages')).status).toBe(403);
  });

  it('pencarian nama dan email (mengandung), ID Santri (cocok tepat, tanpa peka huruf)', async () => {
    expect((await list('q=budi')).rows.map((r) => r.studentCode)).toEqual(['YSR-000103']);
    expect((await list('q=siti.aisyah%40contoh')).rows.map((r) => r.studentCode)).toEqual(['YSR-000102']);
    expect((await list('q=ysr-000104')).rows.map((r) => r.name)).toEqual(['Rina Marlina']);
    expect((await list('q=YSR-0001')).rows).toEqual([]);
  });

  it('filter status, progress, nilai, tahapan, dan gabungannya', async () => {
    const inactive = await list('status=INACTIVE&limit=100');
    expect(inactive.rows.length).toBe(7);
    expect(inactive.rows.every((r) => r.status === 'INACTIVE')).toBe(true);
    const progress = await list('progressMin=40&progressMax=60&limit=100');
    expect(progress.rows.length).toBeGreaterThan(0);
    expect(progress.rows.every((r) => r.learningProgressPct >= 40 && r.learningProgressPct <= 60)).toBe(true);
    const score = await list('scoreMin=80&scoreMax=90&limit=100');
    expect(score.rows.length).toBeGreaterThan(0);
    expect(score.rows.every((r) => r.averageScore !== null && r.averageScore >= 80 && r.averageScore <= 90)).toBe(true);
    const stages = (await call('GET', 'admin/stages')).body.data as { id: string; title: string }[];
    const byStage = await list(`stageId=${stages[1].id}&limit=100`);
    expect(byStage.rows.length).toBeGreaterThan(0);
    expect(byStage.rows.every((r) => r.currentStage === stages[1].title)).toBe(true);
    const combined = await list('status=ACTIVE&progressMax=49&limit=100');
    expect(combined.rows.every((r) => r.status === 'ACTIVE' && r.learningProgressPct <= 49)).toBe(true);
    expect(combined.rows.map((r) => r.studentCode)).toContain('YSR-000102');
    expect(combined.rows.map((r) => r.studentCode)).not.toContain('YSR-000109');
  });

  it('urutan dan pagination dengan batas limit', async () => {
    const byProgress = (await list('sort=progress:desc&limit=100')).rows.map((r) => r.learningProgressPct);
    expect(byProgress).toEqual([...byProgress].sort((a, b) => b - a));
    const byScore = (await list('sort=averageScore:asc&limit=100')).rows.map((r) => r.averageScore);
    const firstNull = byScore.indexOf(null);
    expect(byScore.slice(firstNull).every((value) => value === null)).toBe(true);
    const scored = byScore.slice(0, firstNull) as number[];
    expect(scored).toEqual([...scored].sort((a, b) => a - b));
    const names = (await list('limit=100')).rows.map((r) => r.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'id')));

    const page3 = await list('page=3');
    expect(page3.meta).toEqual({ page: 3, limit: 20, total: 48, totalPages: 3 });
    expect(page3.rows.length).toBe(8);
    expect((await list('limit=500')).meta.limit).toBe(100);
  });

  it('detail, statistik, grafik, riwayat, laporan', async () => {
    const detail = await call('GET', 'admin/students/usr-contoh-3');
    expect(detail.body.data).toMatchObject({ studentCode: 'YSR-000103', status: 'ACTIVE', progress: { learningProgressPct: 64 } });
    expect((await call('GET', 'admin/students/tidak-ada')).status).toBe(404);
    const stats = await call('GET', 'admin/students/usr-contoh-3/statistics');
    expect(stats.body.data).toMatchObject({ bestScore: 88, averageScore: 79.67, evaluatedAttempts: 9 });
    const chart = await call('GET', 'admin/students/usr-contoh-3/chart');
    expect(chart.body.data.points).toHaveLength(9);
    const history = await call('GET', 'admin/students/usr-contoh-1/history?page=1');
    expect(history.body.meta).toEqual({ page: 1, limit: 20, total: 14, totalPages: 1 });
    expect(history.body.data[0]).toMatchObject({ taskTitle: expect.any(String), displayStatus: 'Selesai' });
    const pdf = await mockFetch('GET', 'admin/students/usr-contoh-1/report/pdf', { headers: { Authorization: `Bearer ${token}` }, body: undefined });
    expect(pdf.headers.get('Content-Disposition')).toContain('Laporan-YSR-000101-');
  });

  it('nonaktifkan: santri gagal login dan hilang dari daftar perhatian; aktifkan lagi', async () => {
    expect((await call('PATCH', 'admin/students/usr-santri/status', { status: 'INACTIVE', reason: 'x'.repeat(256) })).status).toBe(422);
    expect((await call('PATCH', 'admin/students/usr-santri/status', { status: 'NONAKTIF' })).body.errors[0].field).toBe('status');
    expect((await call('PATCH', 'admin/students/usr-santri/status', { status: 'INACTIVE', reason: 'Tidak aktif satu semester' })).status).toBe(200);
    const attention = (await call('GET', 'admin/dashboard/attention')).body.data as { studentCode: string }[];
    expect(attention.map((item) => item.studentCode)).not.toContain('YSR-000001');
    expect((await list('q=YSR-000001')).rows[0].status).toBe('INACTIVE');
    expect(await login('santri@yusro.mock', 'santri123')).toMatchObject({ success: false, errorCode: 'AUTH_ACCOUNT_INACTIVE' });

    await login('admin@yusro.mock', 'admin1234');
    expect((await call('PATCH', 'admin/students/usr-santri/status', { status: 'ACTIVE' })).status).toBe(200);
    expect(await login('santri@yusro.mock', 'santri123')).toMatchObject({ success: true });
  });
});

describe('akun dinonaktifkan saat sesi aktif (SDD 3.16.5)', () => {
  it('request berikutnya dari sesi santri ditolak 403 AUTH_ACCOUNT_INACTIVE', async () => {
    const santriToken = token;
    expect((await call('GET', 'learning/stages')).status).toBe(200);
    await login('admin@yusro.mock', 'admin1234');
    await call('PATCH', 'admin/students/usr-santri/status', { status: 'INACTIVE' });
    token = santriToken;
    expect(await call('GET', 'learning/stages')).toMatchObject({ status: 403, body: { errorCode: 'AUTH_ACCOUNT_INACTIVE' } });
  });
});

describe('admin monitoring (SDD 5.18, 3.11.7)', () => {
  type Item = { submissionId: string; attemptNo: number; studentId: string; studentName: string; taskId: string; evaluationStatus: string; score: number | null; submittedAt: string };
  const list = async (query = '') => {
    const response = await call('GET', `admin/submissions?limit=100${query ? `&${query}` : ''}`);
    return { items: response.body.data as Item[], meta: response.body.meta, status: response.status, body: response.body };
  };

  beforeEach(async () => {
    await login('admin@yusro.mock', 'admin1234');
  });

  it('Santri ditolak 403', async () => {
    await login('santri@yusro.mock', 'santri123');
    expect((await call('GET', 'admin/submissions')).status).toBe(403);
    expect((await call('GET', 'admin/evaluation/health')).status).toBe(403);
  });

  it('daftar terbaru dulu, keempat status ada, filter status/santri/tugas/tanggal', async () => {
    const all = await list();
    expect(all.items.length).toBeGreaterThan(20);
    expect(all.items.map((i) => i.submittedAt)).toEqual([...all.items.map((i) => i.submittedAt)].sort().reverse());
    expect(new Set(all.items.map((i) => i.evaluationStatus))).toEqual(new Set(['SUBMITTED', 'PROCESSING', 'EVALUATED', 'FAILED']));
    expect((await call('GET', 'admin/submissions')).body.meta).toMatchObject({ page: 1, limit: 20, totalPages: 2 });

    const failed = await list('status=FAILED');
    expect(failed.items.length).toBeGreaterThanOrEqual(6);
    expect(failed.items.every((i) => i.evaluationStatus === 'FAILED' && i.score === null)).toBe(true);
    expect((await list('status=PROCESSING')).items).toHaveLength(1);

    const byStudent = await list('studentId=usr-contoh-11');
    expect(byStudent.items.map((i) => i.evaluationStatus).sort()).toEqual(['FAILED', 'PROCESSING']);
    const taskId = all.items[0].taskId;
    expect((await list(`taskId=${taskId}`)).items.every((i) => i.taskId === taskId)).toBe(true);
    expect((await list(`status=FAILED&studentId=usr-contoh-11`)).items).toHaveLength(1);

    const today = formatDateStamp(new Date());
    const todayItems = await list(`from=${today}&to=${today}`);
    expect(todayItems.items.length).toBeGreaterThan(0);
    expect(todayItems.items.every((i) => formatDateStamp(new Date(i.submittedAt)) === today)).toBe(true);
    expect((await list('from=2026-10-05&to=2026-10-01')).status).toBe(422);
  });

  it('retry: 202 bentuk SDD, status FAILED → SUBMITTED → PROCESSING → hasil, attemptNo tetap; 409 bila bukan FAILED', async () => {
    const target = (await list('status=FAILED')).items[0];
    const retried = await call('POST', `admin/submissions/${target.submissionId}/retry`);
    expect(retried.status).toBe(202);
    expect(retried.body.data).toMatchObject({ submissionId: target.submissionId, evaluationStatus: 'SUBMITTED', attemptNo: target.attemptNo, isRetry: true, jobId: expect.any(String) });
    const status = async () => (await call('GET', `admin/submissions/${target.submissionId}`)).body.data;
    expect(await status()).toMatchObject({ evaluationStatus: 'SUBMITTED', attemptNo: target.attemptNo, submittedAt: target.submittedAt });
    expect(await call('POST', `admin/submissions/${target.submissionId}/retry`)).toMatchObject({ status: 409, body: { errorCode: 'EVAL_RETRY_NOT_ALLOWED' } });
    vi.setSystemTime(Date.now() + 3000);
    expect((await status()).evaluationStatus).toBe('PROCESSING');
    vi.setSystemTime(Date.now() + 6000);
    expect(await status()).toMatchObject({ evaluationStatus: 'EVALUATED', score: expect.any(Number), attemptNo: target.attemptNo, errorCode: null });

    const second = (await list('status=FAILED')).items[0];
    mockControls.nextEvaluation('FAILED');
    await call('POST', `admin/submissions/${second.submissionId}/retry`);
    vi.setSystemTime(Date.now() + 9000);
    expect(await call('GET', `admin/submissions/${second.submissionId}`)).toMatchObject({ body: { data: { evaluationStatus: 'FAILED', score: null, errorCode: expect.any(String) } } });
  });

  it('URL rekaman, antrean, layanan, dan daftar tugas', async () => {
    const id = (await list()).items[0].submissionId;
    expect((await call('GET', `admin/submissions/${id}/recording-url`)).body.data).toMatchObject({ url: expect.any(String), expiresInSeconds: 300 });
    const queue = (await call('GET', 'admin/evaluation/queue')).body.data;
    expect(queue.counts).toMatchObject({ SUBMITTED: 2, PROCESSING: 1 });
    expect(queue.oldestWaitingSince).toEqual(expect.any(String));
    expect((await call('GET', 'admin/evaluation/health')).body.data).toMatchObject({ serviceStatus: 'ok', modelVersion: 'yusro-mlp-v1.2.0', modelLoaded: true });
    mockControls.setEvaluationService('down');
    expect((await call('GET', 'admin/evaluation/health')).body.data).toMatchObject({ serviceStatus: 'down', modelVersion: null, modelLoaded: false });
    expect((await call('GET', 'admin/dashboard')).body.data.evaluation).toMatchObject({ serviceStatus: 'down', queued: 2, processing: 1 });
    const tasks = (await call('GET', 'admin/tasks?type=IMITATION')).body.data as { type: string }[];
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.type === 'IMITATION')).toBe(true);
  });

  it('riwayat dan statistik Detail Santri memuat submission contoh (konsisten dengan Monitoring)', async () => {
    const history = (await call('GET', 'admin/students/usr-contoh-11/history?limit=100')).body.data as { evaluationStatus: string | null; taskType: string }[];
    expect(history.filter((item) => item.taskType === 'IMITATION').map((item) => item.evaluationStatus)).toEqual(expect.arrayContaining(['FAILED', 'PROCESSING']));
    expect((await call('GET', 'admin/students/usr-contoh-11/statistics')).body.data.failedAttempts).toBe(1);
  });
});
