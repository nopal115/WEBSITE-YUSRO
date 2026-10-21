import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stages = await prisma.stage.findMany({
    orderBy: { order: 'asc' },
    include: {
      materials: {
        orderBy: { order: 'asc' },
        include: {
          audioAssets: {
            include: { audio: true },
          },
          tasks: {
            orderBy: { order: 'asc' },
            include: {
              referenceAudio: true,
              questions: {
                orderBy: { order: 'asc' },
                include: {
                  audio: true,
                  options: true,
                },
              },
            },
          },
        },
      },
      tasks: {
        where: { materialId: null },
        orderBy: { order: 'asc' },
        include: {
          referenceAudio: true,
          questions: {
            orderBy: { order: 'asc' },
            include: {
              audio: true,
              options: true,
            },
          },
        },
      },
    },
  });

  console.log(`=== TOTAL TAHAPAN (STAGES): ${stages.length} ===`);
  let totalMaterials = 0;
  let totalTasks = 0;
  let totalImitations = 0;
  let totalQuizzes = 0;
  let imitationsWithoutAudio = 0;
  let questionsWithoutAudio = 0;
  let materialsWithoutAudio = 0;

  for (const stage of stages) {
    console.log(`\n======================================================`);
    console.log(`TAHAP ${stage.order}: "${stage.title}" (${stage.status})`);
    console.log(`======================================================`);
    console.log(`Total Materi: ${stage.materials.length}`);
    totalMaterials += stage.materials.length;

    for (const mat of stage.materials) {
      const audioCount = mat.audioAssets.length;
      if (audioCount === 0) materialsWithoutAudio++;

      const imitations = mat.tasks.filter((t) => t.type === 'IMITATION');
      const quizzes = mat.tasks.filter((t) => t.type === 'QUIZ');
      totalTasks += mat.tasks.length;
      totalImitations += imitations.length;
      totalQuizzes += quizzes.length;

      const noAudioImitation = imitations.filter((t) => !t.referenceAudioId);
      imitationsWithoutAudio += noAudioImitation.length;

      console.log(`  - Materi ${mat.order}: "${mat.title}" [Audio materi: ${audioCount}] | Tasks: ${mat.tasks.length}`);
      for (const t of mat.tasks) {
        if (t.type === 'IMITATION') {
          const hasAudio = !!t.referenceAudio;
          console.log(`      * [IMITASI] "${t.title}" -> Audio: ${hasAudio ? t.referenceAudio?.originalName : '❌ TIDAK ADA AUDIO!'}`);
        } else {
          const qCount = t.questions.length;
          const qNoAudio = t.questions.filter((q) => !q.audioId);
          questionsWithoutAudio += qNoAudio.length;
          console.log(`      * [KUIS] "${t.title}" -> ${qCount} Soal (Tanpa audio soal: ${qNoAudio.length})`);
        }
      }
    }

    if (stage.tasks.length > 0) {
      console.log(`  [Tugas Tingkat Tahap tanpa materi]: ${stage.tasks.length}`);
      for (const t of stage.tasks) {
        totalTasks++;
        if (t.type === 'IMITATION') {
          totalImitations++;
          if (!t.referenceAudioId) imitationsWithoutAudio++;
          console.log(`      * [IMITASI TAHAP] "${t.title}" -> Audio: ${t.referenceAudio ? t.referenceAudio.originalName : '❌ TIDAK ADA AUDIO!'}`);
        } else {
          totalQuizzes++;
          console.log(`      * [KUIS TAHAP] "${t.title}" -> ${t.questions.length} Soal`);
        }
      }
    }
  }

  const allAudioAssets = await prisma.audioAsset.findMany();
  console.log(`\n======================================================`);
  console.log(`RINGKASAN ASSET AUDIO & DATASET KESELURUHAN:`);
  console.log(`======================================================`);
  console.log(`Total Asset Audio di Database: ${allAudioAssets.length}`);
  console.log(`Total Tahapan (Stages): ${stages.length}`);
  console.log(`Total Materi: ${totalMaterials}`);
  console.log(`Total Tugas/Evaluasi: ${totalTasks} (Imitasi: ${totalImitations}, Kuis: ${totalQuizzes})`);
  console.log(`Materi tanpa audio materi: ${materialsWithoutAudio}`);
  console.log(`Tugas Imitasi TANPA Audio Ustadz: ${imitationsWithoutAudio}`);
  console.log(`Soal Kuis TANPA Audio Pertanyaan: ${questionsWithoutAudio}`);

  const storageFiles = await prisma.audioAsset.findMany({
    select: { objectKey: true, originalName: true, type: true },
  });
  console.log(`Tipe audio:`);
  const typeCounts = storageFiles.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(typeCounts);
}

main().finally(() => prisma.$disconnect());
