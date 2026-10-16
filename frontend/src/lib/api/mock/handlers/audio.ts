// Endpoint Admin audio SDD 5.16 (FR-AUDIO-01 sampai 03). Bentuk respons yang tidak dirinci SDD ditandai
// [ASUMSI] dan dicatat di docs/api-contract.md (2.15).
import { CONTENT, type MockAudio } from '../data/content';
import { db, newId } from '../db';
import { fail, httpError, ok, type MockRequest } from '../http';
import { mockAudioUrl } from '../media';
import type { MockRoute } from '../router';

/** SDD 3.6.5: URL audio berbatas waktu 15 menit. */
const AUDIO_URL_SECONDS = 900;
/** SDD 5.20: unggahan berkas dibatasi 12 MB. */
const UPLOAD_MAX_BYTES = 12 * 1024 * 1024;
/** [DATA CONTOH] Mock tidak membaca isi berkas; durasi unggahan dianggap tetap. */
const UPLOADED_DURATION_MS = 2500;
const KINDS = ['LEARNING', 'REFERENCE'] as const;

const field = (name: string, message: string) => ({ field: name, message });

function findAudio(id: string): MockAudio {
  const audio = CONTENT.audio.find((item) => item.id === id);
  if (!audio) throw httpError(404, 'NOT_FOUND', 'Data tidak ditemukan.');
  return audio;
}

const successorOf = (audio: MockAudio) => CONTENT.audio.find((item) => item.replacesId === audio.id);

/**
 * [ASUMSI] Audio referensi dipakai bila ada submission tugasnya selama versi ini berlaku (sejak diunggah sampai
 * versi penggantinya diunggah). Di backend lewat attempts.reference_audio_id (SDD 3.6.4).
 */
function usedBySubmission(audio: MockAudio): boolean {
  if (audio.kind !== 'REFERENCE' || !audio.taskId) return false;
  const from = Date.parse(audio.createdAt);
  const successor = successorOf(audio);
  const until = successor ? Date.parse(successor.createdAt) : Infinity;
  return db.submissions.some((submission) => submission.taskId === audio.taskId && submission.submittedAtMs >= from && submission.submittedAtMs < until);
}

function usageOf(audio: MockAudio) {
  const task = audio.taskId ? CONTENT.tasks.find((item) => item.id === audio.taskId) : undefined;
  const material = task ? CONTENT.materials.find((item) => item.id === task.materialId) : undefined;
  return task && material ? { taskId: task.id, taskTitle: task.title, materialId: material.id, materialTitle: material.title } : null;
}

/** [ASUMSI] Butir audio admin (2.15). */
function audioView(audio: MockAudio) {
  const { id, kind, originalName, mimeType, sizeBytes, durationMs, version, status, replacesId, createdAt } = audio;
  return { id, kind, originalName, mimeType, sizeBytes, durationMs, version, status, replacesId, createdAt, usedBySubmission: usedBySubmission(audio), usage: usageOf(audio) };
}

/** Seluruh rantai versi (SDD 3.6.4), terbaru dulu. */
function versionsOf(audio: MockAudio): MockAudio[] {
  const previousOf = (item: MockAudio) => CONTENT.audio.find((other) => other.id === item.replacesId);
  let first = audio;
  for (let previous = previousOf(first); previous; previous = previousOf(previous)) first = previous;
  const chain: MockAudio[] = [];
  for (let current: MockAudio | undefined = first; current; current = successorOf(current)) chain.push(current);
  return chain.reverse();
}

/** Validasi berkas multipart `file` (SDD 5.16); mengembalikan galat atau berkasnya. */
function readFile(req: MockRequest): { error: ReturnType<typeof fail> } | { file: Blob; form: FormData } {
  const form = typeof FormData !== 'undefined' && req.body instanceof FormData ? req.body : null;
  const file = form?.get('file');
  if (!form || !(file instanceof Blob)) return { error: fail(422, 'VALIDATION_ERROR', 'Data belum lengkap.', [field('file', 'Pilih berkas audio.')]) };
  if (file.size > UPLOAD_MAX_BYTES) return { error: fail(413, 'PAYLOAD_TOO_LARGE', 'Ukuran berkas melebihi 12 MB.') };
  if (!file.type.startsWith('audio/')) return { error: fail(422, 'VALIDATION_ERROR', 'Data belum valid.', [field('file', 'Berkas harus berupa audio.')]) };
  return { file, form };
}

function createAudio(file: Blob, kind: MockAudio['kind'], extra: Partial<MockAudio> = {}): MockAudio {
  const audio: MockAudio = {
    id: newId('aud'),
    kind,
    originalName: file instanceof File && file.name ? file.name : 'audio-baru',
    mimeType: file.type,
    sizeBytes: file.size,
    durationMs: UPLOADED_DURATION_MS,
    version: 1,
    status: 'ACTIVE',
    replacesId: null,
    taskId: null,
    createdAt: new Date().toISOString(),
    ...extra,
  };
  CONTENT.audio.push(audio);
  return audio;
}

const ARCHIVED = () => httpError(409, 'AUDIO_ARCHIVED', 'Audio ini sudah diarsipkan.');

export const audioRoutes: MockRoute[] = [
  {
    // [ASUMSI] ?kind= dan ?status= menyaring; tanpa pagination; urut nama berkas.
    method: 'GET',
    pattern: '/admin/audio',
    access: 'ADMIN',
    handler: (req) => {
      const kind = req.query.get('kind');
      const status = req.query.get('status');
      const list = CONTENT.audio.filter((audio) => (!kind || audio.kind === kind) && (!status || audio.status === status));
      return ok([...list].sort((a, b) => a.originalName.localeCompare(b.originalName)).map(audioView));
    },
  },
  {
    // [ASUMSI] Detail = butir audio + riwayat versi.
    method: 'GET',
    pattern: '/admin/audio/:id',
    access: 'ADMIN',
    handler: (req) => {
      const audio = findAudio(req.params.id);
      return ok({ ...audioView(audio), versions: versionsOf(audio).map(audioView) });
    },
  },
  {
    // SDD 5.16: multipart file + kind (LEARNING | REFERENCE).
    method: 'POST',
    pattern: '/admin/audio',
    access: 'ADMIN',
    handler: (req) => {
      const read = readFile(req);
      if ('error' in read) return read.error;
      const kind = read.form.get('kind');
      if (!KINDS.includes(kind as MockAudio['kind'])) return fail(422, 'VALIDATION_ERROR', 'Data belum valid.', [field('kind', 'Pilih jenis audio.')]);
      return ok(audioView(createAudio(read.file, kind as MockAudio['kind'])), { status: 201, message: 'Audio berhasil diunggah.' });
    },
  },
  {
    // SDD 5.16 dan 3.6.4: unggah pengganti + arsipkan yang lama dalam satu langkah.
    method: 'POST',
    pattern: '/admin/audio/:id/replace',
    access: 'ADMIN',
    handler: (req) => {
      const old = findAudio(req.params.id);
      if (old.status === 'ARCHIVED') throw ARCHIVED();
      // [ASUMSI] Ganti Versi hanya untuk audio referensi (SDD 7.7.19).
      if (old.kind !== 'REFERENCE') return fail(422, 'VALIDATION_ERROR', 'Ganti versi hanya tersedia untuk audio referensi.');
      const read = readFile(req);
      if ('error' in read) return read.error;
      const created = createAudio(read.file, old.kind, { version: old.version + 1, replacesId: old.id, taskId: old.taskId });
      old.status = 'ARCHIVED';
      // SDD 4.5.9: tasks.reference_audio_id selalu menunjuk versi yang berlaku.
      for (const task of CONTENT.tasks) if (task.type === 'IMITATION' && task.referenceAudioId === old.id) task.referenceAudioId = created.id;
      return ok(audioView(created), { status: 201, message: `Versi ${created.version} aktif. Versi lama diarsipkan.` });
    },
  },
  {
    method: 'POST',
    pattern: '/admin/audio/:id/archive',
    access: 'ADMIN',
    handler: (req) => {
      const audio = findAudio(req.params.id);
      if (audio.status === 'ARCHIVED') throw ARCHIVED();
      // [ASUMSI] SDD 7.7.19: referensi yang sudah dipakai submission hanya dapat diganti versinya.
      if (usedBySubmission(audio)) return fail(409, 'AUDIO_IN_USE_BY_SUBMISSION', 'Audio referensi ini sudah dipakai submission. Gunakan Ganti Versi.');
      // [ASUMSI] Referensi yang berlaku pada tugas AKTIF tidak diarsipkan agar tugas tetap lengkap (SDD 3.7.3).
      if (CONTENT.tasks.some((task) => task.type === 'IMITATION' && task.status === 'ACTIVE' && task.referenceAudioId === audio.id)) return fail(409, 'AUDIO_IN_USE_BY_TASK', 'Audio ini menjadi referensi tugas aktif. Ganti audio referensi tugasnya atau gunakan Ganti Versi.');
      audio.status = 'ARCHIVED';
      return ok(audioView(audio), { message: 'Audio diarsipkan.' });
    },
  },
  {
    // [ASUMSI] { url, expiresInSeconds }; diminta saat pratinjau diputar (SDD 5.16, NFR-PRIV-02).
    method: 'GET',
    pattern: '/admin/audio/:id/url',
    access: 'ADMIN',
    handler: (req) => {
      const audio = findAudio(req.params.id);
      return ok({ url: mockAudioUrl(`audio:${audio.id}`, audio.durationMs), expiresInSeconds: AUDIO_URL_SECONDS });
    },
  },
];
