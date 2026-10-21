import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { LearningService } from '../learning/learning.service';
import { ProgressService } from '../progress/progress.service';

function formatDateJakarta(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningService: LearningService,
    private readonly progressService: ProgressService,
  ) {}

  async getDashboardData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, studentId: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const [
      progress,
      continueTarget,
      lastMaterialRecord,
      lastAttempt,
      userMaterialProgress,
      userTaskProgress,
      userAttempts,
      activeStages,
    ] = await Promise.all([
      this.progressService.getProgress(userId),
      this.learningService.getContinue(userId),
      this.prisma.materialProgress?.findFirst
        ? this.prisma.materialProgress.findFirst({
            where: { userId, completedAt: { not: null }, material: { status: ContentStatus.ACTIVE } },
            orderBy: { completedAt: 'desc' },
            include: { material: { include: { stage: true } } },
          })
        : Promise.resolve(null),
      this.prisma.attempt?.findFirst
        ? this.prisma.attempt.findFirst({
            where: { userId, score: { not: null } },
            orderBy: { submittedAt: 'desc' },
            include: { task: true },
          })
        : Promise.resolve(null),
      this.prisma.materialProgress?.findMany
        ? this.prisma.materialProgress.findMany({
            where: { userId, completedAt: { not: null } },
            select: { materialId: true, completedAt: true },
          })
        : Promise.resolve([]),
      this.prisma.taskProgress?.findMany
        ? this.prisma.taskProgress.findMany({
            where: { userId, completedAt: { not: null } },
            select: { taskId: true, completedAt: true },
          })
        : Promise.resolve([]),
      this.prisma.attempt?.findMany
        ? this.prisma.attempt.findMany({
            where: { userId },
            select: { submittedAt: true },
          })
        : Promise.resolve([]),
      this.prisma.stage?.findMany
        ? this.prisma.stage.findMany({
            where: { status: ContentStatus.ACTIVE },
            orderBy: { order: 'asc' },
            include: {
              materials: {
                where: { status: ContentStatus.ACTIVE },
                select: { id: true },
              },
              tasks: {
                where: { status: ContentStatus.ACTIVE },
                select: { id: true },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const unfinishedTaskRecords = (this.prisma.task?.findMany
      ? await this.prisma.task.findMany({
          where: {
            status: ContentStatus.ACTIVE,
            material: { status: ContentStatus.ACTIVE, stage: { status: ContentStatus.ACTIVE } },
            progress: {
              none: {
                userId,
                completedAt: { not: null },
              },
            },
          },
          include: {
            material: true,
          },
          take: 5,
          orderBy: { order: 'asc' },
        })
      : []) as { id: string; title: string; type?: 'QUIZ' | 'IMITATION'; materialId?: string | null; material?: { title: string } | null }[];

    const unfinishedTasks = unfinishedTaskRecords.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      materialId: t.materialId,
      materialTitle: t.material?.title ?? '',
    }));

    const lastMaterial = lastMaterialRecord?.material
      ? {
          id: lastMaterialRecord.material.id,
          title: lastMaterialRecord.material.title,
          stageTitle: lastMaterialRecord.material.stage?.title ?? '',
        }
      : null;

    const lastAttemptScore =
      lastAttempt && lastAttempt.score !== null
        ? {
            score: Number(lastAttempt.score),
            taskTitle: lastAttempt.task.title,
            submittedAt: lastAttempt.submittedAt.toISOString(),
          }
        : null;

    // --- Daily Streak Calculation ---
    const activeDates = new Set<string>();
    for (const p of userMaterialProgress) {
      if (p.completedAt) activeDates.add(formatDateJakarta(p.completedAt));
    }
    for (const p of userTaskProgress) {
      if (p.completedAt) activeDates.add(formatDateJakarta(p.completedAt));
    }
    for (const a of userAttempts) {
      activeDates.add(formatDateJakarta(a.submittedAt));
    }

    const now = new Date();
    const todayStr = formatDateJakarta(now);
    const activeToday = activeDates.has(todayStr);

    let streakDays = 0;
    const checkCursor = new Date(now);

    if (!activeToday) {
      checkCursor.setDate(checkCursor.getDate() - 1);
      const yesterdayStr = formatDateJakarta(checkCursor);
      if (activeDates.has(yesterdayStr)) {
        while (activeDates.has(formatDateJakarta(checkCursor))) {
          streakDays++;
          checkCursor.setDate(checkCursor.getDate() - 1);
        }
      }
    } else {
      while (activeDates.has(formatDateJakarta(checkCursor))) {
        streakDays++;
        checkCursor.setDate(checkCursor.getDate() - 1);
      }
    }

    // --- Daily Target Calculation ---
    const completedMaterialsToday = userMaterialProgress.filter(
      (p) => p.completedAt && formatDateJakarta(p.completedAt) === todayStr,
    ).length;
    const completedTasksToday = userTaskProgress.filter(
      (p) => p.completedAt && formatDateJakarta(p.completedAt) === todayStr,
    ).length;

    const dailyTarget = {
      targetMaterials: 1,
      completedMaterialsToday,
      targetTasks: 1,
      completedTasksToday,
      isTargetMet: completedMaterialsToday >= 1 && completedTasksToday >= 1,
    };

    // --- Completed Stages for Certificate ---
    const completedMaterialIds = new Set(userMaterialProgress.map((p) => p.materialId));
    const completedTaskIds = new Set(userTaskProgress.map((p) => p.taskId));

    const completedStages = activeStages
      .filter((stg) => {
        const hasContent = stg.materials.length > 0 || stg.tasks.length > 0;
        if (!hasContent) return false;
        const allMaterialsDone = stg.materials.every((m) => completedMaterialIds.has(m.id));
        const allTasksDone = stg.tasks.every((t) => completedTaskIds.has(t.id));
        return allMaterialsDone && allTasksDone;
      })
      .map((stg) => ({
        stageId: stg.id,
        stageTitle: stg.title,
        order: stg.order,
      }));

    return {
      greeting: {
        name: user.name,
        studentCode: user.studentId ?? 'YSR-000001',
      },
      learningProgressPct: progress.learningProgressPct,
      lastMaterial,
      unfinishedTasks,
      lastAttemptScore,
      materialsCompleted: progress.materials.completed,
      tasksCompleted: progress.tasks.completed,
      continueTarget: continueTarget ? { materialId: continueTarget.materialId } : null,
      streak: {
        days: streakDays,
        activeToday,
      },
      dailyTarget,
      completedStages,
    };
  }
}
