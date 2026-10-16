// Endpoint Admin tugas dan soal SDD 5.17 (FR-TASK-01 sampai 06, SDD 3.7). Bentuk respons yang tidak dirinci SDD
// ditandai [ASUMSI] dan dicatat di docs/api-contract.md (2.16).
import { CONTENT, type ContentStatus, type MockQuestion, type MockQuizTask, type MockTask } from '../data/content';
import { findMaterial, findStage, newId } from '../db';
import { fail, httpError, ok, type MockRequest } from '../http';
import type { MockRoute } from '../router';
import { referencedTaskIds } from '../students';

const TITLE_MAX = 200;
const PROMPT_MAX = 2000;
const LABEL_MAX = 255;
const OPTIONS_MIN = 2;
/** [ASUMSI] Batas atas pilihan per soal; SDD hanya mengatur minimal dua. */
const OPTIONS_MAX = 6;

type FieldError = { field: string; message: string };
const field = (name: string, message: string): FieldError => ({ field: name, message });
const byOrder = <T extends { orderIndex: number }>(a: T, b: T) => a.orderIndex - b.orderIndex;
const isStatus = (value: unknown): value is ContentStatus => value === 'DRAFT' || value === 'ACTIVE' || value === 'INACTIVE';

const NOT_FOUND = () => httpError(404, 'NOT_FOUND', 'Data tidak ditemukan.');

function findAdminTask(id: string): MockTask {
  const task = CONTENT.tasks.find((item) => item.id === id);
  if (!task) throw NOT_FOUND();
  return task;
}

function findQuestion(id: string): { task: MockQuizTask; question: MockQuestion } {
  for (const task of CONTENT.tasks) {
    if (task.type !== 'QUIZ') continue;
    const question = task.questions.find((item) => item.id === id);
    if (question) return { task, question };
  }
  throw NOT_FOUND();
}

const tasksIn = (materialId: string) => CONTENT.tasks.filter((task) => task.materialId === materialId).sort(byOrder);
const audioOf = (id: string | null) => (id ? CONTENT.audio.find((audio) => audio.id === id) : undefined);
const audioSummary = (id: string | null) => {
  const audio = audioOf(id);
  return audio ? { id: audio.id, originalName: audio.originalName, durationMs: audio.durationMs, status: audio.status } : null;
};

/** Komponen yang belum lengkap menurut jenis tugas (SDD 3.7.3); kosong = boleh diaktifkan. */
function missingParts(task: MockTask): FieldError[] {
  const missing: FieldError[] = [];
  if (!task.title.trim()) missing.push(field('title', 'Judul wajib diisi.'));
  if (task.type === 'QUIZ') {
    if (task.questions.length === 0) missing.push(field('questions', 'Tambahkan minimal satu soal.'));
  } else {
    const reference = audioOf(task.referenceAudioId);
    if (!reference) missing.push(field('referenceAudioId', 'Pilih audio referensi.'));
    else if (reference.status !== 'ACTIVE') missing.push(field('referenceAudioId', 'Audio referensi sudah diarsipkan. Pilih audio referensi yang aktif.'));
  }
  return missing;
}

/** [ASUMSI] Butir GET admin/tasks; field AS30 (filter Monitoring) tetap ada. */
function taskView(task: MockTask, referenced: Set<string>) {
  const material = findMaterial(task.materialId);
  return {
    id: task.id,
    title: task.title,
    type: task.type,
    materialId: material.id,
    materialTitle: material.title,
    stageId: material.stageId,
    stageTitle: findStage(material.stageId).title,
    orderIndex: task.orderIndex,
    status: task.status,
    questionCount: task.type === 'QUIZ' ? task.questions.length : null,
    referenceAudio: task.type === 'IMITATION' ? audioSummary(task.referenceAudioId) : null,
    isReferenced: referenced.has(task.id),
    isComplete: missingParts(task).length === 0,
  };
}

/** [ASUMSI] GET admin/tasks/:id: butir + kolom yang dapat diubah. */
function taskDetail(task: MockTask) {
  return {
    ...taskView(task, referencedTaskIds()),
    instruction: task.instruction || null,
    referenceAudioId: task.type === 'IMITATION' ? task.referenceAudioId || null : null,
    arabicText: task.type === 'IMITATION' ? task.arabicText || null : null,
  };
}

/** [ASUMSI] Soal admin: is_correct hanya ada di jalur Admin (SDD 3.7.4). */
function questionView(question: MockQuestion) {
  return {
    id: question.id,
    orderIndex: question.orderIndex,
    prompt: question.prompt,
    audioId: question.audioId,
    audio: audioSummary(question.audioId),
    options: [...question.options].sort(byOrder).map((option) => ({ ...option, isCorrect: option.id === question.correctOptionId })),
  };
}

function readText(body: Record<string, unknown>, name: string, max: number, errors: FieldError[]): string | undefined {
  const value = body[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    errors.push(field(name, 'Format tidak valid.'));
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length > max) errors.push(field(name, `Maksimal ${max} karakter.`));
  return trimmed;
}

/** Validasi body soal (SDD 5.17): minimal dua pilihan, tepat satu benar → 422 TASK_ANSWER_KEY_INVALID. */
function parseQuestion(body: unknown) {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const prompt = readText(input, 'prompt', PROMPT_MAX, errors);
  if (!prompt) errors.push(field('prompt', 'Pertanyaan wajib diisi.'));
  const audioId = typeof input.audioId === 'string' ? input.audioId : '';
  const audio = audioOf(audioId);
  if (!audio || audio.kind !== 'LEARNING' || audio.status !== 'ACTIVE') errors.push(field('audioId', 'Pilih audio soal yang aktif.'));
  const rawOptions = Array.isArray(input.options) ? (input.options as Record<string, unknown>[]) : [];
  if (rawOptions.length < OPTIONS_MIN) errors.push(field('options', `Minimal ${OPTIONS_MIN} pilihan jawaban.`));
  if (rawOptions.length > OPTIONS_MAX) errors.push(field('options', `Maksimal ${OPTIONS_MAX} pilihan jawaban.`));
  const options = rawOptions.map((option, index) => {
    const label = readText(option ?? {}, 'label', LABEL_MAX, errors) ?? '';
    if (!label) errors.push(field(`options.${index}.label`, 'Teks pilihan wajib diisi.'));
    return { label, arabicLabel: readText(option ?? {}, 'arabicLabel', LABEL_MAX, errors) ?? '', isCorrect: option?.isCorrect === true };
  });
  if (errors.length) return { error: fail(422, 'VALIDATION_ERROR', 'Soal belum lengkap. Periksa kolom yang ditandai.', errors) };
  if (options.filter((option) => option.isCorrect).length !== 1) return { error: fail(422, 'TASK_ANSWER_KEY_INVALID', 'Tandai tepat satu jawaban benar.') };
  return { value: { prompt: prompt as string, audioId, options } };
}

function applyQuestion(question: MockQuestion, value: { prompt: string; audioId: string; options: { label: string; arabicLabel: string; isCorrect: boolean }[] }) {
  question.prompt = value.prompt;
  question.audioId = value.audioId;
  question.audioKey = `audio:${value.audioId}`;
  question.options = value.options.map((option, index) => ({ id: newId('opt'), label: option.label, arabicLabel: option.arabicLabel, orderIndex: index + 1 }));
  question.correctOptionId = question.options[value.options.findIndex((option) => option.isCorrect)].id;
}

function updateTask(req: MockRequest) {
  const task = findAdminTask(req.params.id);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const title = readText(body, 'title', TITLE_MAX, errors);
  if (body.title !== undefined && !title) errors.push(field('title', 'Judul wajib diisi.'));
  const instruction = readText(body, 'instruction', PROMPT_MAX, errors);
  const arabicText = readText(body, 'arabicText', PROMPT_MAX, errors);
  if (body.status !== undefined && !isStatus(body.status)) errors.push(field('status', 'Status tidak dikenal.'));
  if (errors.length) return fail(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', errors);

  if (body.referenceAudioId !== undefined) {
    if (task.type !== 'IMITATION') return fail(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', [field('referenceAudioId', 'Hanya untuk tugas Dengar-Tirukan.')]);
    const reference = audioOf(typeof body.referenceAudioId === 'string' ? body.referenceAudioId : null);
    if (!reference || reference.kind !== 'REFERENCE' || reference.status !== 'ACTIVE') return fail(422, 'TASK_REFERENCE_NOT_ACTIVE', 'Audio referensi harus berstatus aktif.');
  }

  // Status: AKTIF hanya lewat publish; DRAFT hanya dari AKTIF yang belum dikerjakan; NONAKTIF dari AKTIF (SDD 3.5.3).
  if (isStatus(body.status) && body.status !== task.status) {
    if (body.status === 'ACTIVE') return fail(409, 'CONTENT_INVALID_TRANSITION', 'Gunakan Aktifkan untuk mengaktifkan tugas.');
    if (task.status !== 'ACTIVE') return fail(409, 'CONTENT_INVALID_TRANSITION', 'Perubahan status ini tidak diizinkan.');
    if (body.status === 'DRAFT' && referencedTaskIds().has(task.id)) return fail(409, 'CONTENT_INVALID_TRANSITION', 'Tugas yang sudah dikerjakan tidak dapat dikembalikan ke draf.');
  }

  if (title !== undefined) task.title = title;
  if (instruction !== undefined) task.instruction = instruction;
  if (task.type === 'IMITATION') {
    if (arabicText !== undefined) task.arabicText = arabicText;
    if (typeof body.referenceAudioId === 'string') {
      task.referenceAudioId = body.referenceAudioId;
      const reference = audioOf(task.referenceAudioId);
      if (reference) reference.taskId = task.id;
    }
  }
  if (isStatus(body.status)) task.status = body.status;
  return ok(taskDetail(task), { message: 'Data berhasil disimpan.' });
}

export const taskRoutes: MockRoute[] = [
  {
    // [ASUMSI] ?type= dan ?materialId= menyaring; tanpa pagination; urut tahapan, materi, lalu orderIndex.
    method: 'GET',
    pattern: '/admin/tasks',
    access: 'ADMIN',
    handler: (req) => {
      const type = req.query.get('type');
      const materialId = req.query.get('materialId');
      const referenced = referencedTaskIds();
      const materialRank = new Map(CONTENT.materials.map((material, index) => [material.id, index]));
      const list = CONTENT.tasks
        .filter((task) => (!type || task.type === type) && (!materialId || task.materialId === materialId))
        .sort((a, b) => (materialRank.get(a.materialId) ?? 0) - (materialRank.get(b.materialId) ?? 0) || a.orderIndex - b.orderIndex);
      return ok(list.map((task) => taskView(task, referenced)));
    },
  },
  {
    // [ASUMSI] Body { orderedIds } berisi seluruh tugas satu materi (sama seperti materi, AS36).
    method: 'PATCH',
    pattern: '/admin/tasks/reorder',
    access: 'ADMIN',
    handler: (req) => {
      const ids = (req.body as { orderedIds?: unknown } | undefined)?.orderedIds;
      const orderedIds = Array.isArray(ids) ? (ids as string[]) : [];
      const first = CONTENT.tasks.find((task) => task.id === orderedIds[0]);
      const items = first ? tasksIn(first.materialId) : [];
      const complete = items.length > 0 && orderedIds.length === items.length && new Set(orderedIds).size === orderedIds.length && items.every((task) => orderedIds.includes(task.id));
      if (!complete) return fail(422, 'TASK_REORDER_INCOMPLETE', 'Urutan tidak lengkap. Muat ulang daftar lalu coba lagi.');
      items.forEach((task) => (task.orderIndex = orderedIds.indexOf(task.id) + 1));
      const referenced = referencedTaskIds();
      return ok(tasksIn(items[0].materialId).map((task) => taskView(task, referenced)), { message: 'Urutan tersimpan.' });
    },
  },
  {
    // SDD 5.17: tugas baru berstatus DRAFT di urutan terakhir materinya.
    method: 'POST',
    pattern: '/admin/tasks',
    access: 'ADMIN',
    handler: (req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const errors: FieldError[] = [];
      const title = readText(body, 'title', TITLE_MAX, errors);
      if (!title) errors.push(field('title', 'Judul wajib diisi.'));
      if (body.type !== 'QUIZ' && body.type !== 'IMITATION') errors.push(field('type', 'Pilih jenis tugas.'));
      const material = CONTENT.materials.find((item) => item.id === body.materialId);
      if (!material) errors.push(field('materialId', 'Pilih materi.'));
      if (errors.length || !material || !title) return fail(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', errors);
      const base = { id: newId('tsk'), materialId: material.id, title, instruction: readText(body, 'instruction', PROMPT_MAX, errors) ?? '', orderIndex: tasksIn(material.id).length + 1, status: 'DRAFT' as const };
      const task: MockTask = body.type === 'QUIZ' ? { ...base, type: 'QUIZ', questions: [] } : { ...base, type: 'IMITATION', referenceAudioId: '', arabicText: '', referenceDurationMs: 2000 };
      CONTENT.tasks.push(task);
      return ok(taskDetail(task), { status: 201, message: 'Tugas ditambahkan dengan status DRAFT.' });
    },
  },
  {
    method: 'GET',
    pattern: '/admin/tasks/:id',
    access: 'ADMIN',
    handler: (req) => ok(taskDetail(findAdminTask(req.params.id))),
  },
  { method: 'PATCH', pattern: '/admin/tasks/:id', access: 'ADMIN', handler: updateTask },
  {
    // BR-DELETE-02: hanya DRAFT yang belum pernah dikerjakan; selain itu 409 TASK_IN_USE / transisi tidak sah.
    method: 'DELETE',
    pattern: '/admin/tasks/:id',
    access: 'ADMIN',
    handler: (req) => {
      const task = findAdminTask(req.params.id);
      if (referencedTaskIds().has(task.id)) return fail(409, 'TASK_IN_USE', 'Tugas yang sudah dikerjakan tidak dapat dihapus. Nonaktifkan tugas sebagai gantinya.');
      if (task.status !== 'DRAFT') return fail(409, 'CONTENT_INVALID_TRANSITION', 'Hanya tugas DRAFT yang dapat dihapus.');
      CONTENT.tasks.splice(CONTENT.tasks.indexOf(task), 1);
      tasksIn(task.materialId).forEach((item, index) => (item.orderIndex = index + 1));
      return ok(null, { message: 'Tugas dihapus.' });
    },
  },
  {
    // SDD 5.17: menjadi AKTIF; komponen belum lengkap → 422 TASK_INCOMPLETE dengan errors[] (SDD 3.7.3).
    method: 'POST',
    pattern: '/admin/tasks/:id/publish',
    access: 'ADMIN',
    handler: (req) => {
      const task = findAdminTask(req.params.id);
      if (task.status === 'ACTIVE') return fail(409, 'CONTENT_INVALID_TRANSITION', 'Tugas sudah aktif.');
      const missing = missingParts(task);
      if (missing.length) return fail(422, 'TASK_INCOMPLETE', 'Tugas belum lengkap sehingga belum dapat diaktifkan.', missing);
      task.status = 'ACTIVE';
      return ok(taskDetail(task), { message: 'Tugas diaktifkan.' });
    },
  },
  {
    method: 'GET',
    pattern: '/admin/tasks/:id/questions',
    access: 'ADMIN',
    handler: (req) => {
      const task = findAdminTask(req.params.id);
      return ok(task.type === 'QUIZ' ? [...task.questions].sort(byOrder).map(questionView) : []);
    },
  },
  {
    method: 'POST',
    pattern: '/admin/tasks/:id/questions',
    access: 'ADMIN',
    handler: (req) => {
      const task = findAdminTask(req.params.id);
      if (task.type !== 'QUIZ') return fail(422, 'VALIDATION_ERROR', 'Soal hanya untuk tugas Dengar-Pilih.');
      const parsed = parseQuestion(req.body);
      if (parsed.error) return parsed.error;
      const question: MockQuestion = { id: newId('q'), orderIndex: task.questions.length + 1, prompt: '', audioKey: '', audioId: '', options: [], correctOptionId: '' };
      applyQuestion(question, parsed.value);
      task.questions.push(question);
      return ok(questionView(question), { status: 201, message: 'Soal ditambahkan.' });
    },
  },
  {
    // SDD 3.7.5: riwayat menyimpan snapshot soal, jadi soal tetap dapat diubah setelah dikerjakan.
    method: 'PATCH',
    pattern: '/admin/questions/:id',
    access: 'ADMIN',
    handler: (req) => {
      const { question } = findQuestion(req.params.id);
      const parsed = parseQuestion(req.body);
      if (parsed.error) return parsed.error;
      applyQuestion(question, parsed.value);
      return ok(questionView(question), { message: 'Soal tersimpan.' });
    },
  },
  {
    // [ASUMSI] Soal terakhir pada tugas AKTIF tidak dapat dihapus (tugas menjadi tidak lengkap, SDD 3.7.3).
    method: 'DELETE',
    pattern: '/admin/questions/:id',
    access: 'ADMIN',
    handler: (req) => {
      const { task, question } = findQuestion(req.params.id);
      if (task.status === 'ACTIVE' && task.questions.length === 1) return fail(422, 'TASK_INCOMPLETE', 'Tugas aktif harus memiliki minimal satu soal. Nonaktifkan tugas terlebih dahulu.');
      task.questions.splice(task.questions.indexOf(question), 1);
      task.questions.sort(byOrder).forEach((item, index) => (item.orderIndex = index + 1));
      return ok(null, { message: 'Soal dihapus.' });
    },
  },
];
