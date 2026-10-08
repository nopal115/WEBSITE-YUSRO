// Endpoint Admin konten SDD 5.15 (tahapan, materi, blok) dan audio minimal SDD 5.16. Bentuk respons yang
// tidak dirinci SDD ditandai [ASUMSI] dan dicatat di docs/api-contract.md.
import { CONTENT, type ContentStatus, type MockBlock, type MockMaterial, type MockStage } from '../data/content';
import { db, findMaterial, findStage, newId } from '../db';
import { fail, httpError, ok, type MockRequest } from '../http';
import { mockAudioUrl } from '../media';
import type { MockRoute } from '../router';
import { referencedTaskIds } from '../students';

const pad = (value: number) => String(value).padStart(3, '0');
const byOrder = <T extends { orderIndex: number }>(a: T, b: T) => a.orderIndex - b.orderIndex;
const TITLE_MAX = { stage: 150, material: 200 };
const TRANSLITERATION_MAX = 255;
/** SDD 3.6.5: URL audio berbatas waktu 15 menit. */
const AUDIO_URL_SECONDS = 900;

const NOT_FOUND = () => httpError(404, 'CONTENT_NOT_FOUND', 'Konten tidak ditemukan.');
const field = (name: string, message: string) => ({ field: name, message });

/** Materi dirujuk bila pernah diselesaikan atau tugasnya pernah dikerjakan siapa pun (SDD 3.5.3). */
function referencedMaterialIds(): Set<string> {
  const ids = new Set<string>();
  for (const done of db.materialCompletions.values()) for (const id of done.keys()) ids.add(id);
  const tasks = referencedTaskIds();
  for (const task of CONTENT.tasks) if (tasks.has(task.id)) ids.add(task.materialId);
  return ids;
}

const materialsIn = (stageId: string) => CONTENT.materials.filter((material) => material.stageId === stageId).sort(byOrder);

function stageView(stage: MockStage, referenced: Set<string>) {
  const materials = materialsIn(stage.id);
  return {
    id: stage.id,
    code: stage.code,
    title: stage.title,
    description: stage.description,
    orderIndex: stage.orderIndex,
    status: stage.status,
    materialCount: materials.length,
    isReferenced: materials.some((material) => referenced.has(material.id)),
  };
}

function materialView(material: MockMaterial, referenced: Set<string>) {
  return {
    id: material.id,
    stageId: material.stageId,
    code: material.code,
    title: material.title,
    summary: material.summary,
    orderIndex: material.orderIndex,
    isRequired: material.isRequired,
    status: material.status,
    blockCount: material.blocks.length,
    taskCount: CONTENT.tasks.filter((task) => task.materialId === material.id).length,
    isReferenced: referenced.has(material.id),
  };
}

function blockView(block: MockBlock, index: number) {
  const audio = block.audioId ? CONTENT.audio.find((item) => item.id === block.audioId) : undefined;
  return {
    id: block.id,
    type: block.type,
    orderIndex: index + 1,
    textContent: block.textContent ?? null,
    arabicContent: block.arabicContent ?? null,
    transliteration: block.transliteration ?? null,
    imageUrl: block.imageUrl ?? null,
    audioId: block.audioId ?? null,
    audio: audio ? { id: audio.id, originalName: audio.originalName, durationMs: audio.durationMs } : null,
  };
}

/** Urutan disimpan rapat 1..n dan larik CONTENT ikut diurutkan, agar pemakai berbasis indeks tetap konsisten. */
function normalizeOrder(): void {
  CONTENT.stages.sort(byOrder).forEach((stage, index) => {
    stage.orderIndex = index + 1;
  });
  const stageRank = new Map(CONTENT.stages.map((stage, index) => [stage.id, index]));
  for (const stage of CONTENT.stages) materialsIn(stage.id).forEach((material, index) => (material.orderIndex = index + 1));
  CONTENT.materials.sort((a, b) => (stageRank.get(a.stageId) ?? 0) - (stageRank.get(b.stageId) ?? 0) || a.orderIndex - b.orderIndex);
}

/**
 * SDD 3.5.3: DRAFT → AKTIF, AKTIF → NONAKTIF, NONAKTIF → AKTIF, AKTIF → DRAFT hanya bila belum pernah dirujuk.
 * [ASUMSI] Kalimat pesan; SDD hanya menyebut kode galat.
 */
function assertTransition(from: ContentStatus, to: ContentStatus, referenced: boolean) {
  if (from === to) return null;
  const allowed = (from === 'DRAFT' && to === 'ACTIVE') || (from === 'ACTIVE' && to === 'INACTIVE') || (from === 'INACTIVE' && to === 'ACTIVE') || (from === 'ACTIVE' && to === 'DRAFT' && !referenced);
  if (allowed) return null;
  const message =
    from === 'ACTIVE' && to === 'DRAFT' ? 'Konten yang sudah dipakai dalam riwayat belajar tidak dapat dikembalikan ke draf. Nonaktifkan konten ini sebagai gantinya.' : 'Perubahan status ini tidak diperbolehkan.';
  return fail(409, 'CONTENT_INVALID_TRANSITION', message);
}

const isStatus = (value: unknown): value is ContentStatus => value === 'DRAFT' || value === 'ACTIVE' || value === 'INACTIVE';

function readText(body: Record<string, unknown>, name: string, max: number, required: boolean, errors: { field: string; message: string }[]): string | null | undefined {
  const value = body[name];
  if (value === undefined) {
    if (required) errors.push(field(name, 'Wajib diisi.'));
    return undefined;
  }
  if (value === null) return null;
  if (typeof value !== 'string') {
    errors.push(field(name, 'Harus berupa teks.'));
    return undefined;
  }
  const trimmed = value.trim();
  if (required && trimmed === '') errors.push(field(name, 'Wajib diisi.'));
  if (trimmed.length > max) errors.push(field(name, `Maksimal ${max} karakter.`));
  return trimmed === '' ? null : trimmed;
}

function reorder<T extends { id: string; orderIndex: number }>(items: T[], body: unknown) {
  const orderedIds = (body as { orderedIds?: unknown } | undefined)?.orderedIds;
  const ids = Array.isArray(orderedIds) ? orderedIds : [];
  const complete = ids.length === items.length && new Set(ids).size === ids.length && items.every((item) => ids.includes(item.id));
  if (!complete) return fail(422, 'CONTENT_REORDER_INCOMPLETE', 'Urutan tidak lengkap. Muat ulang daftar lalu coba lagi.');
  items.forEach((item) => (item.orderIndex = ids.indexOf(item.id) + 1));
  normalizeOrder();
  return null;
}

function updateStage(req: MockRequest) {
  const stage = findAdminStage(req.params.id);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const errors: { field: string; message: string }[] = [];
  const title = readText(body, 'title', TITLE_MAX.stage, false, errors);
  const description = readText(body, 'description', 2000, false, errors);
  if (body.title !== undefined && !title) errors.push(field('title', 'Wajib diisi.'));
  if (body.status !== undefined && !isStatus(body.status)) errors.push(field('status', 'Status tidak dikenal.'));
  if (errors.length) return fail(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', errors);
  const referenced = referencedMaterialIds();
  if (isStatus(body.status)) {
    const conflict = assertTransition(stage.status, body.status, stageView(stage, referenced).isReferenced);
    if (conflict) return conflict;
    stage.status = body.status;
  }
  if (title) stage.title = title;
  if (description !== undefined) stage.description = description;
  return ok(stageView(stage, referenced), { message: 'Data berhasil disimpan.' });
}

function updateMaterial(req: MockRequest) {
  const material = findAdminMaterial(req.params.id);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const errors: { field: string; message: string }[] = [];
  const title = readText(body, 'title', TITLE_MAX.material, false, errors);
  const summary = readText(body, 'summary', 2000, false, errors);
  if (body.title !== undefined && !title) errors.push(field('title', 'Wajib diisi.'));
  if (body.isRequired !== undefined && typeof body.isRequired !== 'boolean') errors.push(field('isRequired', 'Harus benar/salah.'));
  if (body.status !== undefined && !isStatus(body.status)) errors.push(field('status', 'Status tidak dikenal.'));
  if (errors.length) return fail(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', errors);
  const referenced = referencedMaterialIds();
  if (isStatus(body.status)) {
    const conflict = assertTransition(material.status, body.status, referenced.has(material.id));
    if (conflict) return conflict;
    material.status = body.status;
  }
  if (title) material.title = title;
  if (summary !== undefined) material.summary = summary;
  if (typeof body.isRequired === 'boolean') material.isRequired = body.isRequired;
  return ok(materialView(material, referenced), { message: 'Data berhasil disimpan.' });
}

function findAdminStage(id: string): MockStage {
  try {
    return findStage(id);
  } catch {
    throw NOT_FOUND();
  }
}

function findAdminMaterial(id: string): MockMaterial {
  try {
    return findMaterial(id);
  } catch {
    throw NOT_FOUND();
  }
}

/** Validasi blok sesuai chk_material_blocks_payload (SDD 4.5.7); galat per blok di errors[] (field blocks.N.x). */
function parseBlocks(material: MockMaterial, body: unknown) {
  const input = (body as { blocks?: unknown } | undefined)?.blocks;
  if (!Array.isArray(input)) return { errors: [field('blocks', 'Daftar blok wajib dikirim.')] };
  const errors: { field: string; message: string }[] = [];
  const blocks: MockBlock[] = input.map((raw, index) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const text = (name: string) => (typeof item[name] === 'string' && (item[name] as string).trim() !== '' ? (item[name] as string).trim() : undefined);
    const base = { id: typeof item.id === 'string' && material.blocks.some((b) => b.id === item.id) ? item.id : newId('blk') };
    if (item.type === 'TEXT') {
      const textContent = text('textContent');
      const arabicContent = text('arabicContent');
      const transliteration = text('transliteration');
      if (!textContent && !arabicContent) errors.push(field(`blocks.${index}.textContent`, 'Isi teks atau teks Arab.'));
      if (transliteration && transliteration.length > TRANSLITERATION_MAX) errors.push(field(`blocks.${index}.transliteration`, `Maksimal ${TRANSLITERATION_MAX} karakter.`));
      return { ...base, type: 'TEXT', textContent, arabicContent, transliteration };
    }
    if (item.type === 'AUDIO') {
      const audioId = text('audioId');
      if (!audioId || !CONTENT.audio.some((audio) => audio.id === audioId && audio.status === 'ACTIVE')) errors.push(field(`blocks.${index}.audioId`, 'Pilih audio pembelajaran.'));
      return { ...base, type: 'AUDIO', audioId };
    }
    if (item.type === 'IMAGE') {
      const imageUrl = text('imageUrl');
      if (!imageUrl) errors.push(field(`blocks.${index}.imageUrl`, 'Alamat gambar wajib ada.'));
      return { ...base, type: 'IMAGE', imageUrl };
    }
    errors.push(field(`blocks.${index}.type`, 'Jenis blok tidak dikenal.'));
    return { ...base, type: 'TEXT' };
  });
  return errors.length ? { errors } : { blocks };
}

export const contentRoutes: MockRoute[] = [
  // Tahapan. reorder didaftarkan sebelum :id agar tidak tertangkap pola :id.
  {
    method: 'PATCH',
    pattern: '/admin/stages/reorder',
    access: 'ADMIN',
    handler: (req) => {
      const conflict = reorder(CONTENT.stages, req.body);
      if (conflict) return conflict;
      const referenced = referencedMaterialIds();
      return ok(CONTENT.stages.map((stage) => stageView(stage, referenced)), { message: 'Urutan tersimpan.' });
    },
  },
  {
    // [ASUMSI] Daftar lengkap tanpa pagination, urut orderIndex. Field id, code, title, orderIndex, status
    // sudah dipakai filter Daftar Santri (A2) dan tetap ada.
    method: 'GET',
    pattern: '/admin/stages',
    access: 'ADMIN',
    handler: () => {
      const referenced = referencedMaterialIds();
      return ok([...CONTENT.stages].sort(byOrder).map((stage) => stageView(stage, referenced)));
    },
  },
  {
    method: 'POST',
    pattern: '/admin/stages',
    access: 'ADMIN',
    handler: (req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const errors: { field: string; message: string }[] = [];
      const title = readText(body, 'title', TITLE_MAX.stage, true, errors);
      const description = readText(body, 'description', 2000, false, errors);
      if (errors.length) return fail(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', errors);
      // [ASUMSI] Kode dibuat server (lNNN berikutnya); tahapan baru berstatus DRAFT di urutan terakhir.
      const next = Math.max(0, ...CONTENT.stages.map((stage) => Number(stage.code.slice(1)) || 0)) + 1;
      const stage: MockStage = { id: `stg-l${pad(next)}`, code: `l${pad(next)}`, title: title as string, description: description ?? null, orderIndex: CONTENT.stages.length + 1, status: 'DRAFT' };
      CONTENT.stages.push(stage);
      normalizeOrder();
      return ok(stageView(stage, referencedMaterialIds()), { status: 201, message: 'Tahapan ditambahkan.' });
    },
  },
  { method: 'GET', pattern: '/admin/stages/:id', access: 'ADMIN', handler: (req) => ok(stageView(findAdminStage(req.params.id), referencedMaterialIds())) },
  { method: 'PATCH', pattern: '/admin/stages/:id', access: 'ADMIN', handler: updateStage },
  {
    method: 'DELETE',
    pattern: '/admin/stages/:id',
    access: 'ADMIN',
    handler: (req) => {
      const stage = findAdminStage(req.params.id);
      const view = stageView(stage, referencedMaterialIds());
      // BR-DELETE-02: hanya DRAFT yang belum dirujuk; materi masih ada → ditolak (FK ON DELETE RESTRICT, SDD 4.5.6).
      if (stage.status !== 'DRAFT' || view.isReferenced) return fail(409, 'CONTENT_IN_USE', 'Tahapan ini sudah dipakai dalam riwayat belajar dan tidak dapat dihapus. Nonaktifkan tahapan sebagai gantinya.');
      if (view.materialCount > 0) return fail(409, 'CONTENT_IN_USE', 'Tahapan masih berisi materi. Hapus materinya terlebih dahulu.');
      CONTENT.stages.splice(CONTENT.stages.indexOf(stage), 1);
      normalizeOrder();
      return ok(null, { message: 'Tahapan dihapus.' });
    },
  },
  // Materi.
  {
    method: 'PATCH',
    pattern: '/admin/materials/reorder',
    access: 'ADMIN',
    handler: (req) => {
      // [ASUMSI] stageId tidak dikirim; tahapan ditentukan dari id pertama. Seluruh materi tahapan wajib disertakan.
      const firstId = ((req.body as { orderedIds?: unknown[] } | undefined)?.orderedIds ?? [])[0];
      const stageId = CONTENT.materials.find((material) => material.id === firstId)?.stageId;
      if (!stageId) return fail(422, 'CONTENT_REORDER_INCOMPLETE', 'Urutan tidak lengkap. Muat ulang daftar lalu coba lagi.');
      const conflict = reorder(materialsIn(stageId), req.body);
      if (conflict) return conflict;
      const referenced = referencedMaterialIds();
      return ok(materialsIn(stageId as string).map((material) => materialView(material, referenced)), { message: 'Urutan tersimpan.' });
    },
  },
  {
    // [ASUMSI] ?stageId= menyaring per tahapan; tanpa pagination, urut orderIndex.
    method: 'GET',
    pattern: '/admin/materials',
    access: 'ADMIN',
    handler: (req) => {
      const stageId = req.query.get('stageId');
      const referenced = referencedMaterialIds();
      const items = stageId ? materialsIn(stageId) : CONTENT.materials;
      return ok(items.map((material) => materialView(material, referenced)));
    },
  },
  {
    method: 'POST',
    pattern: '/admin/materials',
    access: 'ADMIN',
    handler: (req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const errors: { field: string; message: string }[] = [];
      const stage = typeof body.stageId === 'string' ? CONTENT.stages.find((item) => item.id === body.stageId) : undefined;
      if (!stage) errors.push(field('stageId', 'Pilih tahapan.'));
      const title = readText(body, 'title', TITLE_MAX.material, true, errors);
      const summary = readText(body, 'summary', 2000, false, errors);
      if (body.isRequired !== undefined && typeof body.isRequired !== 'boolean') errors.push(field('isRequired', 'Harus benar/salah.'));
      if (errors.length || !stage) return fail(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', errors);
      // [ASUMSI] Kode dibuat server (<kode tahapan>mNNN berikutnya); materi baru DRAFT, di urutan terakhir, tanpa tugas.
      const siblings = materialsIn(stage.id);
      const next = Math.max(0, ...siblings.map((material) => Number(material.code.split('m').pop()) || 0)) + 1;
      const code = `${stage.code}m${pad(next)}`;
      const material: MockMaterial = {
        id: `mat-${code}`,
        code,
        stageId: stage.id,
        title: title as string,
        summary: summary ?? null,
        orderIndex: siblings.length + 1,
        isRequired: body.isRequired === undefined ? true : (body.isRequired as boolean),
        status: 'DRAFT',
        blocks: [],
        letters: [],
        practice: [],
      };
      CONTENT.materials.push(material);
      normalizeOrder();
      return ok(materialView(material, referencedMaterialIds()), { status: 201, message: 'Materi ditambahkan.' });
    },
  },
  { method: 'GET', pattern: '/admin/materials/:id', access: 'ADMIN', handler: (req) => ok(materialView(findAdminMaterial(req.params.id), referencedMaterialIds())) },
  { method: 'PATCH', pattern: '/admin/materials/:id', access: 'ADMIN', handler: updateMaterial },
  {
    method: 'DELETE',
    pattern: '/admin/materials/:id',
    access: 'ADMIN',
    handler: (req) => {
      const material = findAdminMaterial(req.params.id);
      if (material.status !== 'DRAFT' || referencedMaterialIds().has(material.id)) {
        return fail(409, 'CONTENT_IN_USE', 'Materi ini sudah dipakai dalam riwayat belajar dan tidak dapat dihapus. Nonaktifkan materi sebagai gantinya.');
      }
      CONTENT.materials.splice(CONTENT.materials.indexOf(material), 1);
      for (let index = CONTENT.tasks.length - 1; index >= 0; index -= 1) if (CONTENT.tasks[index].materialId === material.id) CONTENT.tasks.splice(index, 1);
      normalizeOrder();
      return ok(null, { message: 'Materi dihapus.' });
    },
  },
  {
    method: 'GET',
    pattern: '/admin/materials/:id/blocks',
    access: 'ADMIN',
    handler: (req) => ok(findAdminMaterial(req.params.id).blocks.map(blockView)),
  },
  {
    // [ASUMSI] Body { blocks: [...] }; urutan = urutan larik; seluruh blok diganti sekaligus.
    method: 'PUT',
    pattern: '/admin/materials/:id/blocks',
    access: 'ADMIN',
    handler: (req) => {
      const material = findAdminMaterial(req.params.id);
      const parsed = parseBlocks(material, req.body);
      if (parsed.errors) return fail(422, 'VALIDATION_ERROR', 'Konten belum lengkap. Periksa blok yang ditandai.', parsed.errors);
      material.blocks = parsed.blocks;
      return ok(material.blocks.map(blockView), { message: 'Konten materi tersimpan.' });
    },
  },
  // Audio (minimal, SDD 5.16; dipakai lagi di A5).
  {
    // [ASUMSI] ?kind= menyaring jenis audio; tanpa pagination.
    method: 'GET',
    pattern: '/admin/audio',
    access: 'ADMIN',
    handler: (req) => {
      const kind = req.query.get('kind');
      return ok(CONTENT.audio.filter((audio) => !kind || audio.kind === kind).map((audio) => ({ ...audio })));
    },
  },
  {
    // [ASUMSI] { url, expiresInSeconds }; diminta saat pratinjau diputar (SDD 5.16, NFR-PRIV-02).
    method: 'GET',
    pattern: '/admin/audio/:id/url',
    access: 'ADMIN',
    handler: (req) => {
      const audio = CONTENT.audio.find((item) => item.id === req.params.id);
      if (!audio) throw httpError(404, 'NOT_FOUND', 'Data tidak ditemukan.');
      return ok({ url: mockAudioUrl(`audio:${audio.id}`, audio.durationMs), expiresInSeconds: AUDIO_URL_SECONDS });
    },
  },
];
