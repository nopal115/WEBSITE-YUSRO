import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';

const activeStages = () => CONTENT.stages.filter((stage) => stage.status === 'ACTIVE');
const activeMaterials = () => CONTENT.materials.filter((material) => material.status === 'ACTIVE');

describe('data konten tiruan', () => {
  it('berisi 10 tahapan dan 68 materi AKTIF dengan jumlah per tahapan sesuai data proyek', () => {
    expect(activeStages()).toHaveLength(10);
    expect(activeMaterials()).toHaveLength(68);
    const counts = activeStages().map((stage) => activeMaterials().filter((m) => m.stageId === stage.id).length);
    expect(counts).toEqual([10, 21, 16, 1, 2, 6, 6, 2, 2, 2]);
    expect(activeMaterials()[0].code).toBe('l001m001');
    expect(activeMaterials()[activeMaterials().length - 1].code).toBe('l010m002');
  });

  it('[DATA CONTOH] satu tahapan DRAFT, satu materi NONAKTIF, satu blok gambar, dan pustaka audio', () => {
    expect(CONTENT.stages.filter((stage) => stage.status === 'DRAFT')).toHaveLength(1);
    expect(CONTENT.materials.filter((material) => material.status === 'INACTIVE')).toHaveLength(1);
    expect(CONTENT.materials.find((m) => m.code === 'l001m002')?.blocks.map((b) => b.type)).toContain('IMAGE');
    expect(CONTENT.audio.length).toBeGreaterThan(68);
  });

  it('setiap materi punya satu tugas QUIZ dan satu IMITATION', () => {
    expect(CONTENT.tasks).toHaveLength(136);
    for (const material of activeMaterials()) {
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
