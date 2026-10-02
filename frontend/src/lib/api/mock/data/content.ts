// Data konten tiruan Metode Yusro. Judul T1–T2 dari Figma dan teks Arab l001m001/l002m001
// dari data konten proyek; selebihnya [DATA CONTOH].
import type { ImitationConstraints } from '../../../../features/imitation/types';

export interface Letter {
  arabic: string;
  /** [DATA CONTOH] Transliterasi untuk label pilihan jawaban. */
  label: string;
}

export interface MockStage {
  id: string;
  code: string;
  title: string;
  orderIndex: number;
}

export interface MockMaterial {
  id: string;
  code: string;
  stageId: string;
  title: string;
  orderIndex: number;
  isRequired: boolean;
  letters: Letter[];
  practice: string[];
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

function buildContent() {
  const stages: MockStage[] = [];
  const materials: MockMaterial[] = [];
  const tasks: MockTask[] = [];
  let globalIndex = 0;

  MATERIAL_COUNTS.forEach((count, stageIndex) => {
    const stageNo = stageIndex + 1;
    const stage: MockStage = {
      id: `stg-l${pad(stageNo)}`,
      code: `l${pad(stageNo)}`,
      title: STAGE_TITLES[stageNo] ?? `[DATA CONTOH] Tahapan ${stageNo}`,
      orderIndex: stageNo,
    };
    stages.push(stage);

    for (let materialNo = 1; materialNo <= count; materialNo += 1) {
      const code = `${stage.code}m${pad(materialNo)}`;
      const generic = [0, 1, 2].map((offset) => LETTER_POOL[(globalIndex * 3 + offset) % LETTER_POOL.length]);
      const special = SPECIAL_MATERIALS[code];
      const material: MockMaterial = {
        id: `mat-${code}`,
        code,
        stageId: stage.id,
        title: `[DATA CONTOH] Materi ${materialNo}`,
        orderIndex: materialNo,
        isRequired: true,
        letters: special?.letters ?? generic,
        practice: special?.practice ?? [generic.map((item) => item.arabic).join(' ')],
      };
      materials.push(material);
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

  return { stages, materials, tasks };
}

export const CONTENT = buildContent();
