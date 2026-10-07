import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';

describe('data konten tiruan', () => {
  it('berisi 10 tahapan dan 68 materi dengan jumlah per tahapan sesuai data proyek', () => {
    expect(CONTENT.stages).toHaveLength(10);
    expect(CONTENT.materials).toHaveLength(68);
    const counts = CONTENT.stages.map((stage) => CONTENT.materials.filter((m) => m.stageId === stage.id).length);
    expect(counts).toEqual([10, 21, 16, 1, 2, 6, 6, 2, 2, 2]);
    expect(CONTENT.materials[0].code).toBe('l001m001');
    expect(CONTENT.materials[CONTENT.materials.length - 1].code).toBe('l010m002');
  });

  it('setiap materi punya satu tugas QUIZ dan satu IMITATION', () => {
    expect(CONTENT.tasks).toHaveLength(136);
    for (const material of CONTENT.materials) {
      const types = CONTENT.tasks.filter((task) => task.materialId === material.id).map((task) => task.type);
      expect(types.sort()).toEqual(['IMITATION', 'QUIZ']);
    }
  });

  it('setiap tugas QUIZ berisi 5 soal × 4 opsi unik dengan kunci di antara opsinya', () => {
    for (const task of CONTENT.tasks) {
      if (task.type !== 'QUIZ') continue;
      expect(task.questions).toHaveLength(5);
      for (const question of task.questions) {
        expect(question.options).toHaveLength(4);
        expect(new Set(question.options.map((o) => o.arabicLabel)).size).toBe(4);
        expect(question.options.map((o) => o.id)).toContain(question.correctOptionId);
      }
    }
  });

  it('memakai teks Arab contoh untuk l001m001 dan l002m001', () => {
    const [l001m001, l002m001] = ['l001m001', 'l002m001'].map((code) => CONTENT.materials.find((m) => m.code === code));
    expect(l001m001?.letters.map((l) => l.arabic)).toEqual(['بَ', 'مَ', 'فَ']);
    expect(l001m001?.practice).toEqual(['بَ بَ', 'مَ مَ', 'فَ فَ']);
    expect(l002m001?.practice).toHaveLength(7);
    expect(CONTENT.stages[0].title).toBe('Huruf hijaiah terputus dengan fathah, kasrah, dammah');
  });
});
