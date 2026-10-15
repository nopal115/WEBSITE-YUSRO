import { describe, expect, it } from 'vitest';
import { allAnswered, buildSubmitInput, mapResults, nextStep, previousStep } from '../session';
import type { QuizQuestion } from '../types';

const option = (id: string, label: string) => ({ id, label, arabicLabel: label, orderIndex: 1 });
const questions: QuizQuestion[] = [
  { id: 'q2', orderIndex: 2, prompt: 'Soal dua', audioUrl: 'a2', options: [option('q2a', 'Ta'), option('q2b', 'Tsa')] },
  { id: 'q1', orderIndex: 1, prompt: 'Soal satu', audioUrl: 'a1', options: [option('q1a', 'Alif'), option('q1b', 'Ba')] },
];

describe('urutan langkah', () => {
  it('maju per soal lalu ke ringkasan setelah soal terakhir', () => {
    expect(nextStep({ kind: 'question', index: 0 }, 2)).toEqual({ kind: 'question', index: 1 });
    expect(nextStep({ kind: 'question', index: 1 }, 2)).toEqual({ kind: 'summary' });
    expect(nextStep({ kind: 'summary' }, 2)).toEqual({ kind: 'summary' });
  });

  it('bisa kembali ke soal sebelumnya, tidak kurang dari soal pertama', () => {
    expect(previousStep({ kind: 'question', index: 1 })).toEqual({ kind: 'question', index: 0 });
    expect(previousStep({ kind: 'question', index: 0 })).toEqual({ kind: 'question', index: 0 });
  });
});

describe('allAnswered (SDD 3.9.8)', () => {
  it('true hanya bila setiap soal punya jawaban', () => {
    expect(allAnswered(questions, {})).toBe(false);
    expect(allAnswered(questions, { q1: 'q1a' })).toBe(false);
    expect(allAnswered(questions, { q1: 'q1a', q2: 'q2b' })).toBe(true);
    expect(allAnswered([], {})).toBe(false);
  });
});

describe('buildSubmitInput', () => {
  it('mengirim semua jawaban sekaligus, urut sesuai orderIndex', () => {
    expect(buildSubmitInput(questions, { q2: 'q2b', q1: 'q1a' })).toEqual({
      answers: [
        { questionId: 'q1', optionId: 'q1a' },
        { questionId: 'q2', optionId: 'q2b' },
      ],
    });
  });
});

describe('mapResults (SDD 7.7.9)', () => {
  it('memetakan jawaban santri, kunci, dan benar/salah dari respons server', () => {
    const rows = mapResults(questions, {
      results: [
        { questionId: 'q2', isCorrect: false, selectedOptionId: 'q2b', correctOptionId: 'q2a' },
        { questionId: 'q1', isCorrect: true, selectedOptionId: 'q1b', correctOptionId: 'q1b' },
      ],
    });
    expect(rows.map((row) => [row.number, row.prompt, row.selected?.label, row.correct?.label, row.isCorrect])).toEqual([
      [1, 'Soal satu', 'Ba', 'Ba', true],
      [2, 'Soal dua', 'Tsa', 'Ta', false],
    ]);
  });
});
