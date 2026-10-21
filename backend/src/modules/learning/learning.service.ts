import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, ContentStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getStages(userId: string) {
    await this.assertActiveUser(userId);
    const stages = await this.prisma.stage.findMany({
      where: { status: ContentStatus.ACTIVE },
      orderBy: { order: 'asc' },
      include: {
        materials: {
          where: { status: ContentStatus.ACTIVE },
          orderBy: { order: 'asc' },
          include: { progress: { where: { userId }, select: { completedAt: true } } },
        },
      },
    });

    const completedMaterialIds = await this.prisma.materialProgress.findMany({
      where: { userId, material: { status: ContentStatus.ACTIVE }, completedAt: { not: null } },
      select: { materialId: true },
    });
    const done = new Set(completedMaterialIds.map((item) => item.materialId));

    let previousStageComplete = true;
    return stages.map((stage, index) => {
      const isUnlocked = previousStageComplete;
      let previousMaterialComplete = true;
      const materials = stage.materials.map((material) => {
        const completed = material.progress.some((item) => item.completedAt !== null);
        const materialUnlocked = isUnlocked && previousMaterialComplete;
        previousMaterialComplete = completed;
        return {
          id: material.id,
          title: material.title,
          order: material.order,
          isRequired: material.isRequired,
          status: material.status,
          isUnlocked: materialUnlocked,
          isCompleted: completed,
        };
      });
      const access = isUnlocked ? 'UNLOCKED' : 'LOCKED';
      const materialsCompleted = stage.materials.filter((material) => done.has(material.id)).length;
      const isCompleted = stage.materials.filter((material) => material.isRequired).every((material) => done.has(material.id));
      previousStageComplete = isCompleted;

      return {
        id: stage.id,
        code: this.makeStageCode(index + 1),
        title: stage.title,
        orderIndex: stage.order,
        access,
        isCompleted,
        ...(access === 'LOCKED' ? { lockReason: `Selesaikan seluruh materi wajib pada Tahapan ${index}.` } : {}),
        materialsTotal: stage.materials.length,
        materialsCompleted,
        materials,
      };
    });
  }

  async getStageMaterials(userId: string, stageId: string) {
    await this.assertActiveUser(userId);
    const stage = await this.prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        materials: {
          where: { status: ContentStatus.ACTIVE },
          orderBy: { order: 'asc' },
          include: { progress: { where: { userId }, select: { completedAt: true } } },
        },
      },
    });
    if (!stage) throw new NotFoundException('Stage not found');

    const stageSummary = (await this.getStages(userId)).find((item) => item.id === stageId);
    if (!stageSummary || stageSummary.access === 'LOCKED') {
      throw new ForbiddenException('Tahapan ini belum terbuka.');
    }

    const taskIds = stage.materials.map((material) => material.id);
    const tasks = await this.prisma.task.findMany({
      where: { materialId: { in: taskIds }, status: ContentStatus.ACTIVE },
      select: { id: true, materialId: true },
    });
    const materialTasks = tasks.filter((task): task is { id: string; materialId: string } => task.materialId !== null);
    const completedTaskIds = await this.prisma.taskProgress.findMany({
      where: { userId, taskId: { in: materialTasks.map((task) => task.id) }, completedAt: { not: null } },
      select: { taskId: true },
    });
    const completedSet = new Set(completedTaskIds.map((item) => item.taskId));
    const taskCountByMaterial = new Map<string, number>();
    const tasksCompletedByMaterial = new Map<string, number>();
    for (const task of materialTasks) {
      const currentCount = taskCountByMaterial.get(task.materialId) ?? 0;
      taskCountByMaterial.set(task.materialId, currentCount + 1);
      if (completedSet.has(task.id)) {
        const currentCompleted = tasksCompletedByMaterial.get(task.materialId) ?? 0;
        tasksCompletedByMaterial.set(task.materialId, currentCompleted + 1);
      }
    }

    let previousMaterialComplete = true;
    const materials = stage.materials.map((material) => {
      const completed = material.progress.some((item) => item.completedAt !== null);
      const status: 'COMPLETED' | 'AVAILABLE' | 'LOCKED' = previousMaterialComplete ? (completed ? 'COMPLETED' : 'AVAILABLE') : 'LOCKED';
      previousMaterialComplete = completed;
      const taskCount = taskCountByMaterial.get(material.id) ?? 0;
      const tasksCompleted = tasksCompletedByMaterial.get(material.id) ?? 0;

      return {
        id: material.id,
        code: this.makeMaterialCode(stage.order, material.order),
        title: material.title,
        orderIndex: material.order,
        isRequired: material.isRequired,
        status,
        ...(status === 'LOCKED' ? { lockReason: 'Selesaikan materi sebelumnya terlebih dahulu.' } : { taskCount, tasksCompleted }),
      };
    });

    return {
      stage: { id: stage.id, title: stage.title, access: 'UNLOCKED' },
      materials,
    };
  }

  async getMaterial(userId: string, materialId: string) {
    await this.assertActiveUser(userId);
    const material = await this.prisma.material.findFirst({
      where: { id: materialId, status: ContentStatus.ACTIVE },
      include: {
        stage: true,
        audioAssets: {
          include: {
            audio: {
              select: {
                id: true,
                objectKey: true,
                durationMs: true,
                durationSeconds: true,
              },
            },
          },
        },
        tasks: {
          where: { status: ContentStatus.ACTIVE },
          orderBy: { order: 'asc' },
          include: { progress: { where: { userId }, select: { completedAt: true, bestScore: true, attemptCount: true } } },
        },
      },
    });
    if (!material) throw new NotFoundException('Material not found');

    const stages = await this.getStages(userId);
    const stageSummary = stages.find((item) => item.id === material.stageId);
    if (!stageSummary || stageSummary.access === 'LOCKED') {
      throw new ForbiddenException('Material is locked');
    }

    const stageMaterials = await this.getStageMaterials(userId, material.stageId);
    const summary = stageMaterials.materials.find((item) => item.id === materialId);
    if (!summary || summary.status === 'LOCKED') throw new ForbiddenException('Material is locked');

    const blocks = [] as Array<{
      type: 'TEXT' | 'AUDIO' | 'IMAGE';
      orderIndex: number;
      textContent?: string;
      arabicContent?: string;
      transliteration?: string;
      audioUrl?: string;
      durationMs?: number;
      imageUrl?: string;
    }>;
    if (material.contentText) {
      if (material.contentText.startsWith('[')) {
        try {
          const parsed = JSON.parse(material.contentText);
          if (Array.isArray(parsed)) {
            for (const b of parsed) {
              blocks.push({
                type: b.type ?? 'TEXT',
                orderIndex: blocks.length + 1,
                textContent: b.textContent ?? undefined,
                arabicContent: b.arabicContent ?? undefined,
                transliteration: b.transliteration ?? undefined,
                imageUrl: b.imageUrl ?? undefined,
              });
            }
          }
        } catch {
          blocks.push({ type: 'TEXT', orderIndex: blocks.length + 1, textContent: material.contentText });
        }
      } else {
        blocks.push({ type: 'TEXT', orderIndex: blocks.length + 1, textContent: material.contentText });
      }
    }
    if (material.contentImageUrl) {
      blocks.push({ type: 'IMAGE', orderIndex: blocks.length + 1, imageUrl: material.contentImageUrl });
    }
    for (const link of material.audioAssets) {
      const audio = link.audio;
      blocks.push({
        type: 'AUDIO',
        orderIndex: blocks.length + 1,
        audioUrl: await this.storage.getSignedGetUrl(audio.objectKey),
        durationMs: audio.durationMs ?? Math.round((audio.durationSeconds ?? 0) * 1000),
      });
    }

    const orderedMaterials = await this.prisma.material.findMany({
      where: { stageId: material.stageId, status: ContentStatus.ACTIVE },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    const currentIndex = orderedMaterials.findIndex((item) => item.id === materialId);
    const previousMaterialId = currentIndex > 0 ? orderedMaterials[currentIndex - 1].id : null;
    const nextMaterialId = currentIndex >= 0 && currentIndex < orderedMaterials.length - 1 ? orderedMaterials[currentIndex + 1].id : null;
    const nextLocked = nextMaterialId ? (stageMaterials.materials.find((item) => item.id === nextMaterialId)?.status ?? 'LOCKED') === 'LOCKED' : false;

    return {
      id: material.id,
      code: this.makeMaterialCode(material.stage.order, material.order),
      title: material.title,
      isRequired: material.isRequired,
      status: summary.status,
      blocks,
      tasks: material.tasks.map((task) => ({
        id: task.id,
        type: task.type,
        title: task.title,
        status: task.progress.some((entry) => entry.completedAt !== null) ? 'COMPLETED' : 'AVAILABLE',
        bestScore: task.progress[0]?.bestScore ? Number(task.progress[0].bestScore) : null,
        attemptCount: task.progress[0]?.attemptCount ?? 0,
      })),
      navigation: {
        previousMaterialId: previousMaterialId,
        nextMaterialId: nextMaterialId,
        nextMaterialLocked: nextLocked,
      },
    };
  }

  async getContinue(userId: string) {
    await this.assertActiveUser(userId);
    const stages = await this.prisma.stage.findMany({
      where: { status: ContentStatus.ACTIVE },
      orderBy: { order: 'asc' },
      include: {
        materials: {
          where: { status: ContentStatus.ACTIVE },
          orderBy: { order: 'asc' },
          include: { progress: { where: { userId }, select: { completedAt: true } } },
        },
      },
    });

    let previousStageComplete = true;
    for (const stage of stages) {
      if (!previousStageComplete) break;
      let previousMaterialComplete = true;
      for (const material of stage.materials) {
        const completed = material.progress.some((item) => item.completedAt !== null);
        const status = previousMaterialComplete ? (completed ? 'COMPLETED' : 'AVAILABLE') : 'LOCKED';
        if (status === 'AVAILABLE') {
          return { materialId: material.id, materialTitle: material.title, stageTitle: stage.title };
        }
        previousMaterialComplete = completed;
      }
      previousStageComplete = stage.materials.filter((material) => material.isRequired).every((material) => material.progress.some((item) => item.completedAt !== null));
    }

    return null;
  }

  async completeMaterial(userId: string, materialId: string, requireTasks = false) {
    await this.assertActiveUser(userId);
    const material = await this.prisma.material.findFirst({
      where: { id: materialId, status: ContentStatus.ACTIVE },
      select: { id: true, stageId: true, title: true, isRequired: true, order: true, stage: { select: { id: true, order: true, title: true } } },
    });
    if (!material) throw new NotFoundException('Material not found');

    const stagesBefore = await this.getStages(userId);
    const stageSummary = stagesBefore.find((stage) => stage.id === material.stageId);
    if (!stageSummary || stageSummary.access === 'LOCKED') throw new ForbiddenException('Material is locked');

    const materialSummary = (await this.getStageMaterials(userId, material.stageId)).materials.find((item) => item.id === materialId);
    if (!materialSummary || materialSummary.status === 'LOCKED') throw new ForbiddenException('Material is locked');

    if (requireTasks) {
      const activeTasks = await this.prisma.task.findMany({
        where: { materialId, status: ContentStatus.ACTIVE },
        select: {
          id: true,
          progress: {
            where: { userId, completedAt: { not: null } },
            select: { completedAt: true },
          },
        },
      });
      const hasUnfinishedTasks = activeTasks.some((t) => t.progress.length === 0);
      if (hasUnfinishedTasks) {
        throw new BadRequestException('Selesaikan kuis/tugas pada materi ini terlebih dahulu untuk menyelesaikan materi.');
      }
    }

    const completedAt = new Date();
    await this.prisma.materialProgress.upsert({
      where: { userId_materialId: { userId, materialId } },
      update: { completedAt },
      create: { userId, materialId, completedAt },
    });

    const [totalMaterials, completedMaterials, totalTasks, completedTasks] = await Promise.all([
      this.prisma.material.count({ where: { status: ContentStatus.ACTIVE } }),
      this.prisma.materialProgress.count({ where: { userId, completedAt: { not: null }, material: { status: ContentStatus.ACTIVE } } }),
      this.prisma.task.count({ where: { status: ContentStatus.ACTIVE } }),
      this.prisma.taskProgress.count({ where: { userId, completedAt: { not: null }, task: { status: ContentStatus.ACTIVE } } }),
    ]);
    const learningProgressPct = totalMaterials + totalTasks === 0 ? 0 : Math.round(((completedMaterials + completedTasks) / (totalMaterials + totalTasks)) * 100);
    const stagesAfter = await this.getStages(userId);
    const stageUnlocked = stagesAfter.find((stage) => {
      const beforeAccess = stagesBefore.find((item) => item.id === stage.id)?.access ?? 'LOCKED';
      return beforeAccess === 'LOCKED' && stage.access === 'UNLOCKED';
    });

    return {
      materialId: material.id,
      completedAt: completedAt.toISOString(),
      progress: {
        learningProgressPct,
        materialsCompleted: completedMaterials,
        materialsTotal: totalMaterials,
        tasksCompleted: completedTasks,
        tasksTotal: totalTasks,
      },
      stageUnlocked: stageUnlocked ? { id: stageUnlocked.id, code: stageUnlocked.code, title: stageUnlocked.title } : null,
    };
  }

  private makeStageCode(stageOrder: number): string {
    return `STG-${String(stageOrder).padStart(3, '0')}`;
  }

  private makeMaterialCode(stageOrder: number, materialOrder: number): string {
    return `MAT-${String(stageOrder).padStart(2, '0')}-${String(materialOrder).padStart(2, '0')}`;
  }

  private async assertActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Account is inactive');
  }
}
