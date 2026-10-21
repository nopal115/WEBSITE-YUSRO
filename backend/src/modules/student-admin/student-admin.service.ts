import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, ContentStatus, EvaluationStatus, TaskType, UserRole } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { ProgressService } from '../progress/progress.service';

export interface ListStudentsQuery {
  page?: number;
  limit?: number;
  q?: string;
  stageId?: string;
  status?: AccountStatus;
  progressMin?: number;
  progressMax?: number;
  scoreMin?: number;
  scoreMax?: number;
  sort?: string;
}

@Injectable()
export class StudentAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService?: ProgressService,
  ) {}

  async listStudents(query: ListStudentsQuery | string = {}) {
    const queryObj = typeof query === 'string' ? { q: query } : query;
    const page = Math.max(1, Number(queryObj.page) || 1);
    const limit = Math.min(Math.max(1, Number(queryObj.limit) || 20), 100);
    const search = queryObj.q?.trim();

    const where: any = {
      role: UserRole.SANTRI,
      ...(queryObj.status ? { status: queryObj.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { studentId: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    // Ambil seluruh santri yang cocok dengan kriteria pencarian akun
    const allMatchingStudents = await this.prisma.user.findMany({
      where,
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        studentId: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const [allStages, allMaterials, allTasks] = await Promise.all([
      this.prisma.stage?.findMany
        ? this.prisma.stage.findMany({
            where: { status: ContentStatus.ACTIVE },
            orderBy: { order: 'asc' },
            select: { id: true, title: true, order: true },
          })
        : Promise.resolve([]),
      this.prisma.material?.findMany
        ? this.prisma.material.findMany({
            where: { status: ContentStatus.ACTIVE },
            select: { id: true, stageId: true, isRequired: true },
          })
        : Promise.resolve([]),
      this.prisma.task?.findMany
        ? this.prisma.task.findMany({
            where: { status: ContentStatus.ACTIVE },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    const safeStages = allStages || [];
    const safeMaterials = allMaterials || [];
    const safeTasks = allTasks || [];
    const totalActivities = safeMaterials.length + safeTasks.length;

    // Kumpulkan ringkasan progres dan nilai untuk setiap santri
    const enrichedList = await Promise.all(
      allMatchingStudents.map(async (student) => {
        const [completedMaterialsCount, completedTasksCount, validAttempts, latestActivity] =
          await Promise.all([
            this.prisma.materialProgress?.count
              ? this.prisma.materialProgress.count({
                  where: {
                    userId: student.id,
                    completedAt: { not: null },
                    material: { status: ContentStatus.ACTIVE },
                  },
                })
              : Promise.resolve(0),
            this.prisma.taskProgress?.count
              ? this.prisma.taskProgress.count({
                  where: {
                    userId: student.id,
                    completedAt: { not: null },
                    task: { status: ContentStatus.ACTIVE },
                  },
                })
              : Promise.resolve(0),
            this.prisma.attempt?.findMany
              ? this.prisma.attempt.findMany({
                  where: {
                    userId: student.id,
                    score: { not: null },
                    OR: [
                      { taskType: TaskType.QUIZ },
                      { taskType: TaskType.IMITATION, evaluationStatus: EvaluationStatus.EVALUATED },
                    ],
                  },
                  select: { taskId: true, score: true },
                })
              : Promise.resolve([]),
            this.prisma.attempt?.findFirst
              ? this.prisma.attempt.findFirst({
                  where: { userId: student.id },
                  orderBy: { submittedAt: 'desc' },
                  select: { submittedAt: true },
                })
              : Promise.resolve(null),
          ]);

        const completedActivities = (completedMaterialsCount ?? 0) + (completedTasksCount ?? 0);
        const learningProgressPct =
          totalActivities === 0 ? 0 : Math.round((completedActivities / totalActivities) * 100);

        // Hitung nilai terbaik per tugas lalu dirata-ratakan
        const bestByTask = new Map<string, number>();
        for (const att of (validAttempts || [])) {
          bestByTask.set(att.taskId, Math.max(bestByTask.get(att.taskId) ?? 0, Number(att.score)));
        }
        const bestScores = [...bestByTask.values()];
        const averageScore =
          bestScores.length === 0
            ? null
            : Math.round((bestScores.reduce((sum, s) => sum + s, 0) / bestScores.length) * 100) / 100;

        // Cari tahapan aktif santri saat ini
        const currentStageTitle = allStages[0]?.title ?? null;

        return {
          id: student.id,
          studentCode: student.studentId ?? 'YSR-000001',
          name: student.name,
          email: student.email,
          currentStage: currentStageTitle,
          learningProgressPct,
          averageScore,
          status: student.status,
          lastActivityAt: latestActivity?.submittedAt ? latestActivity.submittedAt.toISOString() : null,
          createdAt: student.createdAt,
        };
      }),
    );

    // Filter lanjutan: progressMin, progressMax, scoreMin, scoreMax
    let filtered = enrichedList.filter((item) => {
      if (queryObj.progressMin !== undefined && item.learningProgressPct < queryObj.progressMin) return false;
      if (queryObj.progressMax !== undefined && item.learningProgressPct > queryObj.progressMax) return false;
      if (queryObj.scoreMin !== undefined) {
        if (item.averageScore === null || item.averageScore < queryObj.scoreMin) return false;
      }
      if (queryObj.scoreMax !== undefined) {
        if (item.averageScore === null || item.averageScore > queryObj.scoreMax) return false;
      }
      return true;
    });

    // Pengurutan
    const sort = queryObj.sort || 'name:asc';
    const [sortField, sortOrder] = sort.split(':');
    const isDesc = sortOrder === 'desc';

    filtered.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (valA === null || valA === undefined) valA = isDesc ? -Infinity : Infinity;
      if (valB === null || valB === undefined) valB = isDesc ? -Infinity : Infinity;
      if (valA < valB) return isDesc ? 1 : -1;
      if (valA > valB) return isDesc ? -1 : 1;
      return 0;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const skip = (page - 1) * limit;
    const paged = filtered.slice(skip, skip + limit);

    return {
      data: paged,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getStudentDetail(studentId: string) {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, role: UserRole.SANTRI },
      select: {
        id: true,
        studentId: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
      },
    });
    if (!student) throw new NotFoundException('Santri tidak ditemukan');

    const [progress, latestActivity, firstStage] = await Promise.all([
      this.progressService ? this.progressService.getProgress(studentId) : Promise.resolve(null),
      this.prisma.attempt.findFirst({
        where: { userId: studentId },
        orderBy: { submittedAt: 'desc' },
        select: { submittedAt: true },
      }),
      this.prisma.stage.findFirst({
        where: { status: ContentStatus.ACTIVE },
        orderBy: { order: 'asc' },
        select: { id: true, title: true },
      }),
    ]);

    return {
      id: student.id,
      studentCode: student.studentId ?? 'YSR-000001',
      name: student.name,
      email: student.email,
      status: student.status,
      joinedAt: student.createdAt.toISOString(),
      lastActivityAt: latestActivity?.submittedAt ? latestActivity.submittedAt.toISOString() : null,
      currentStage: firstStage ? { id: firstStage.id, title: firstStage.title } : null,
      progress,
    };
  }

  async setStudentStatus(studentId: string, status: AccountStatus, reason?: string, actorId?: string) {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, role: UserRole.SANTRI },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Santri tidak ditemukan');

    const updated = await this.prisma.user.update({
      where: { id: studentId },
      data: { status },
      select: {
        id: true,
        studentId: true,
        email: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });

    if (status === AccountStatus.INACTIVE) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: studentId } });
    }

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'STUDENT_STATUS_CHANGED',
          entityType: 'User',
          entityId: studentId,
          metadata: { status, reason: reason || null },
        },
      });
    }

    return {
      ...updated,
      studentCode: updated.studentId ?? 'YSR-000001',
    };
  }

  async getStages() {
    const stages = await this.prisma.stage.findMany({
      where: { status: ContentStatus.ACTIVE },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, order: true, status: true },
    });

    return stages.map((s, index) => ({
      id: s.id,
      code: `l${String(index + 1).padStart(3, '0')}`,
      title: s.title,
      orderIndex: s.order,
      status: s.status,
    }));
  }
}
