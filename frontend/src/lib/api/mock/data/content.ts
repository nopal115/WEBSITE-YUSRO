// Data konten tiruan Metode Yusro. Judul T1–T2 dari Figma dan teks Arab l001m001/l002m001
// dari data konten proyek; selebihnya [DATA CONTOH].
import type { ImitationConstraints } from '../../../../features/imitation/types';

export interface Letter {
  arabic: string;
  /** [DATA CONTOH] Transliterasi untuk label pilihan jawaban. */
  label: string;
}

/** SDD 4.5.5 content_status. */
export type ContentStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface MockStage {
  id: string;
  code: string;
  title: string;
  description: string | null;
  orderIndex: number;
  status: ContentStatus;
}

/** Blok konten materi (SDD 4.5.7); urutan = urutan array. */
export interface MockBlock {
  id: string;
  type: 'TEXT' | 'AUDIO' | 'IMAGE';
  textContent?: string;
  arabicContent?: string;
  transliteration?: string;
  audioId?: string;
  imageUrl?: string;
}

export interface MockMaterial {
  id: string;
  code: string;
  stageId: string;
  title: string;
  summary: string | null;
  orderIndex: number;
  isRequired: boolean;
  status: ContentStatus;
  blocks: MockBlock[];
  letters: Letter[];
  practice: string[];
}

/** [DATA CONTOH] Audio pembelajaran (SDD 4.5.8 audio_assets, kind LEARNING). Suaranya sintetis. */
export interface MockAudio {
  id: string;
  kind: 'LEARNING' | 'REFERENCE';
  originalName: string;
  durationMs: number;
  status: 'ACTIVE' | 'ARCHIVED';
}

export interface MockQuestion {
  id: string;
  orderIndex: number;
  prompt: string;
  audioKey: string;
  options: { id: string; label: string; arabicLabel: string; orderIndex: number }[];
  correctOptionId: string;
}

export interface MockQuizTask {
  id: string;
  materialId: string;
  type: 'QUIZ';
  title: string;
  instruction: string;
  questions: MockQuestion[];
}

export interface MockImitationTask {
  id: string;
  materialId: string;
  type: 'IMITATION';
  title: string;
  instruction: string;
  arabicText: string;
  referenceDurationMs: number;
}

export type MockTask = MockQuizTask | MockImitationTask;

/** SRS FR-IMITATE-06 (keputusan proyek); contoh SDD 5.10 sudah usang. */
export const IMITATION_CONSTRAINTS: ImitationConstraints = {
  acceptedFormats: ['audio/webm;codecs=opus', 'audio/mp4'],
  minDurationMs: 1000,
  maxDurationMs: 30000,
  maxSizeBytes: 5242880,
  cooldownSeconds: 10,
};

const MATERIAL_COUNTS = [10, 21, 16, 1, 2, 6, 6, 2, 2, 2];

const STAGE_TITLES: Record<number, string> = {
  1: 'Huruf hijaiah terputus dengan fathah, kasrah, dammah',
  2: 'Membaca dan membandingkan huruf hijaiah terputus',
};

// Urutan huruf mengikuti latihan l002m001.
const LETTER_POOL: Letter[] = [
  ['اَ', 'A (alif)'], ['بَ', 'Ba'], ['تَ', 'Ta'], ['ثَ', 'Tsa'], ['جَ', 'Ja'], ['حَ', 'Ḥa'], ['خَ', 'Kho'],
  ['سَ', 'Sa'], ['شَ', 'Sya'], ['صَ', 'Sho'], ['ضَ', 'Dho'], ['طَ', 'Tho'], ['ظَ', 'Zha'], ['عَ', "'A"],
  ['غَ', 'Gho'], ['فَ', 'Fa'], ['قَ', 'Qo'], ['كَ', 'Ka'], ['لَ', 'La'], ['مَ', 'Ma'], ['نَ', 'Na'],
  ['وَ', 'Wa'], ['هَ', 'Ha'], ['ءَ', 'A (hamzah)'], ['يَ', 'Ya'],
].map(([arabic, label]) => ({ arabic, label }));

const letter = (arabic: string): Letter => LETTER_POOL.find((item) => item.arabic === arabic) as Letter;

const SPECIAL_MATERIALS: Record<string, { letters: Letter[]; practice: string[] }> = {
  l001m001: { letters: ['بَ', 'مَ', 'فَ'].map(letter), practice: ['بَ بَ', 'مَ مَ', 'فَ فَ'] },
  l002m001: {
    letters: LETTER_POOL,
    practice: ['اَ بَ تَ ثَ', 'جَ حَ خَ', 'سَ شَ صَ ضَ', 'طَ ظَ عَ غَ', 'فَ قَ كَ لَ', 'مَ نَ وَ هَ', 'ءَ يَ'],
  },
};

const QUESTIONS_PER_QUIZ = 5;
const OPTIONS_PER_QUESTION = 4;

const pad = (value: number) => String(value).padStart(3, '0');

function buildQuestions(material: MockMaterial, seed: number): MockQuestion[] {
  return Array.from({ length: QUESTIONS_PER_QUIZ }, (_, index) => {
    const correct = material.letters[index % material.letters.length];
    const correctPoolIndex = LETTER_POOL.indexOf(correct);
    const choices = [correct];
    for (let step = 1; choices.length < OPTIONS_PER_QUESTION; step += 1) {
      const candidate = LETTER_POOL[(correctPoolIndex + step * 5 + seed) % LETTER_POOL.length];
      if (!choices.includes(candidate)) choices.push(candidate);
    }
    // Posisi jawaban benar diputar agar tidak selalu di urutan pertama.
    const rotated = choices.map((_, i) => choices[(i + index) % choices.length]);
    const questionId = `q-${material.code}-${index + 1}`;
    const options = rotated.map((item, i) => ({ id: `${questionId}-o${i + 1}`, label: item.label, arabicLabel: item.arabic, orderIndex: i + 1 }));
    return {
      id: questionId,
      orderIndex: index + 1,
      prompt: 'Huruf apakah yang dibaca?',
      audioKey: `letter:${correct.arabic}`,
      options,
      correctOptionId: options[rotated.indexOf(correct)].id,
    };
  });
}

/** [DATA CONTOH] Gambar sederhana (SVG data URI) untuk blok IMAGE contoh; tidak butuh jaringan. */
const SAMPLE_IMAGE_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120"><rect width="320" height="120" rx="12" fill="#E6F0F2"/><text x="160" y="72" font-size="40" text-anchor="middle" fill="#0F4C5C" font-family="serif">بَ مَ فَ</text></svg>');

function materialBlocks(code: string, letters: Letter[], practice: string[]): MockBlock[] {
  return [
    { id: `blk-${code}-t1`, type: 'TEXT', textContent: `[DATA CONTOH] Penjelasan materi ${code}.` },
    { id: `blk-${code}-t2`, type: 'TEXT', arabicContent: letters.map((l) => l.arabic).join('  '), transliteration: letters.map((l) => l.label).join(', ') },
    ...practice.map((line, i): MockBlock => ({ id: `blk-${code}-p${i + 1}`, type: 'TEXT', arabicContent: line })),
    { id: `blk-${code}-a1`, type: 'AUDIO', audioId: `aud-${code}` },
  ];
}

function buildContent() {
  const stages: MockStage[] = [];
  const materials: MockMaterial[] = [];
  const tasks: MockTask[] = [];
  const audio: MockAudio[] = [];
  let globalIndex = 0;

  MATERIAL_COUNTS.forEach((count, stageIndex) => {
    const stageNo = stageIndex + 1;
    const stage: MockStage = {
      id: `stg-l${pad(stageNo)}`,
      code: `l${pad(stageNo)}`,
      title: STAGE_TITLES[stageNo] ?? `[DATA CONTOH] Tahapan ${stageNo}`,
      description: null,
      orderIndex: stageNo,
      status: 'ACTIVE',
    };
    stages.push(stage);

    for (let materialNo = 1; materialNo <= count; materialNo += 1) {
      const code = `${stage.code}m${pad(materialNo)}`;
      const generic = [0, 1, 2].map((offset) => LETTER_POOL[(globalIndex * 3 + offset) % LETTER_POOL.length]);
      const special = SPECIAL_MATERIALS[code];
      const letters = special?.letters ?? generic;
      const practice = special?.practice ?? [generic.map((item) => item.arabic).join(' ')];
      const material: MockMaterial = {
        id: `mat-${code}`,
        code,
        stageId: stage.id,
        title: `[DATA CONTOH] Materi ${materialNo}`,
        summary: null,
        orderIndex: materialNo,
        isRequired: true,
        status: 'ACTIVE',
        blocks: materialBlocks(code, letters, practice),
        letters,
        practice,
      };
      materials.push(material);
      audio.push({ id: `aud-${code}`, kind: 'LEARNING', originalName: `audio-materi-${code}.wav`, durationMs: 2000, status: 'ACTIVE' });
      tasks.push(
        {
          id: `tsk-${code}-quiz`,
          materialId: material.id,
          type: 'QUIZ',
          title: 'Latihan Dengar-Pilih',
          instruction: 'Dengarkan audio berikut, lalu pilih jawaban yang benar.',
          questions: buildQuestions(material, globalIndex),
        },
        {
          id: `tsk-${code}-imitation`,
          materialId: material.id,
          type: 'IMITATION',
          title: 'Latihan Dengar-Tirukan',
          instruction: 'Dengarkan contoh bacaan, lalu tirukan dan rekam suara Anda.',
          arabicText: material.practice[0],
          referenceDurationMs: 2000,
        },
      );
      globalIndex += 1;
    }
  });

  // [DATA CONTOH] Blok gambar lama pada satu materi (penyunting A4 tidak boleh menghapusnya diam-diam).
  const withImage = materials.find((material) => material.code === 'l001m002');
  withImage?.blocks.splice(1, 0, { id: 'blk-l001m002-img', type: 'IMAGE', imageUrl: SAMPLE_IMAGE_URL });

  // [DATA CONTOH] Konten NONAKTIF dan DRAFT di bagian akhir, agar halaman Santri yang sudah diuji tidak berubah.
  const lastStage = stages[stages.length - 1];
  const inactiveCode = `${lastStage.code}m${pad(materials.filter((m) => m.stageId === lastStage.id).length + 1)}`;
  materials.push({
    id: `mat-${inactiveCode}`, code: inactiveCode, stageId: lastStage.id, title: '[DATA CONTOH] Materi lama (nonaktif)', summary: null,
    orderIndex: materials.filter((m) => m.stageId === lastStage.id).length + 1, isRequired: false, status: 'INACTIVE',
    blocks: [{ id: `blk-${inactiveCode}-t1`, type: 'TEXT', textContent: '[DATA CONTOH] Materi ini sudah dinonaktifkan.' }], letters: [], practice: [],
  });
  const draftNo = stages.length + 1;
  const draftStage: MockStage = { id: `stg-l${pad(draftNo)}`, code: `l${pad(draftNo)}`, title: `[DATA CONTOH] Tahapan ${draftNo} (draf)`, description: 'Tahapan yang sedang disusun.', orderIndex: draftNo, status: 'DRAFT' };
  stages.push(draftStage);
  materials.push({
    id: `mat-${draftStage.code}m001`, code: `${draftStage.code}m001`, stageId: draftStage.id, title: '[DATA CONTOH] Materi draf', summary: null,
    orderIndex: 1, isRequired: true, status: 'DRAFT', blocks: [{ id: `blk-${draftStage.code}m001-t1`, type: 'TEXT', textContent: '[DATA CONTOH] Konten sedang disusun.' }], letters: [], practice: [],
  });

  audio.push(
    { id: 'aud-contoh-1', kind: 'LEARNING', originalName: 'contoh-bacaan-fathah.wav', durationMs: 3200, status: 'ACTIVE' },
    { id: 'aud-contoh-2', kind: 'LEARNING', originalName: 'contoh-bacaan-kasrah.wav', durationMs: 2800, status: 'ACTIVE' },
    { id: 'aud-contoh-3', kind: 'LEARNING', originalName: 'contoh-bacaan-dammah.wav', durationMs: 3000, status: 'ACTIVE' },
  );

  return { stages, materials, tasks, audio };
}

/** Konten mock yang dapat diubah Admin (A4); direset di tempat agar semua impor tetap menunjuk objek yang sama. */
export const CONTENT = buildContent();

export function resetContent(): void {
  const fresh = buildContent();
  CONTENT.stages.splice(0, CONTENT.stages.length, ...fresh.stages);
  CONTENT.materials.splice(0, CONTENT.materials.length, ...fresh.materials);
  CONTENT.tasks.splice(0, CONTENT.tasks.length, ...fresh.tasks);
  CONTENT.audio.splice(0, CONTENT.audio.length, ...fresh.audio);
}
