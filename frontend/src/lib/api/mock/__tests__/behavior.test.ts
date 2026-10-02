import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockControls } from '../controls';
import { CONTENT, type MockQuizTask } from '../data/content';
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
