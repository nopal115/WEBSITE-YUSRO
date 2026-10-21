import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, ContentStatus, EvaluationStatus, TaskType, UserRole } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStudentStatistics(userId: string) {
    await this.assertActiveStudent(userId);
    return this.buildStatistics(userId);
  }

  async getStudentHistory(userId: string) {
    await this.assertActiveStudent(userId);
    return this.getValidHistory(userId);
  }

  async getChartData(userId: string) {
    await this.assertActiveStudent(userId);

    const validAttempts = await this.prisma.attempt.findMany({
      where: {
        userId,
        score: { not: null },
        OR: [
          { taskType: TaskType.QUIZ },
          { taskType: TaskType.IMITATION, evaluationStatus: EvaluationStatus.EVALUATED },
        ],
      },
      include: { task: true },
      orderBy: { submittedAt: 'asc' },
    });

    const points = validAttempts.map((attempt, index) => ({
      sequence: index + 1,
      attemptId: attempt.id,
      taskTitle: attempt.task.title,
      score: Number(attempt.score),
      submittedAt: attempt.submittedAt.toISOString(),
    }));

    let trend: 'UP' | 'DOWN' | 'FLAT' | 'INSUFFICIENT_DATA' = 'INSUFFICIENT_DATA';
    if (points.length >= 2) {
      const last = points[points.length - 1].score;
      const prev = points[points.length - 2].score;
      if (last > prev) trend = 'UP';
      else if (last < prev) trend = 'DOWN';
      else trend = 'FLAT';
    }

    return { points, trend };
  }

  async getStudentOverviewForAdmin() {
    const students = await this.prisma.user.findMany({
      where: { role: UserRole.SANTRI },
      select: { id: true, studentId: true, name: true, email: true, status: true },
      orderBy: { name: 'asc' },
    });
    return Promise.all(
      students.map(async (student) => ({
        ...student,
        statistics: await this.buildStatistics(student.id),
      })),
    );
  }

  private async buildStatistics(userId: string) {
    const [totalMaterials, completedMaterials, totalTasks, completedTasks, history, failedAttempts] =
      await Promise.all([
        this.prisma.material.count({ where: { status: ContentStatus.ACTIVE } }),
        this.prisma.materialProgress.count({
          where: { userId, completedAt: { not: null }, material: { status: ContentStatus.ACTIVE } },
        }),
        this.prisma.task.count({ where: { status: ContentStatus.ACTIVE } }),
        this.prisma.taskProgress.count({
          where: { userId, completedAt: { not: null }, task: { status: ContentStatus.ACTIVE } },
        }),
        this.getValidHistory(userId),
        this.prisma.attempt.count({
          where: { userId, evaluationStatus: EvaluationStatus.FAILED },
        }),
      ]);

    const bestByTask = new Map<string, number>();
    for (const item of history) {
      bestByTask.set(item.taskId, Math.max(bestByTask.get(item.taskId) ?? 0, item.score));
    }
    const bestScores = [...bestByTask.values()];
    const totalActivities = totalMaterials + totalTasks;
    const learningProgressPct =
      totalActivities === 0 ? 0 : Math.round(((completedMaterials + completedTasks) / totalActivities) * 100);

    return {
      materialsCompleted: completedMaterials,
      tasksCompleted: completedTasks,
      progress: learningProgressPct,
      learningProgressPct,
      averageScore:
        bestScores.length === 0
          ? null
          : Math.round((bestScores.reduce((sum, score) => sum + score, 0) / bestScores.length) * 100) / 100,
      bestScore: bestScores.length === 0 ? null : Math.max(...bestScores),
      validEvaluationCount: history.length,
      evaluatedAttempts: history.length,
      failedAttempts,
    };
  }

  private async getValidHistory(userId: string) {
    const items = await this.prisma.attempt.findMany({
      where: {
        userId,
        score: { not: null },
        OR: [
          { taskType: TaskType.QUIZ },
          { taskType: TaskType.IMITATION, evaluationStatus: EvaluationStatus.EVALUATED },
        ],
      },
      select: {
        id: true,
        taskId: true,
        score: true,
        feedbackCategory: true,
        evaluatedAt: true,
        submittedAt: true,
      },
      orderBy: { submittedAt: 'asc' },
    });

    return items.map((item) => ({
      submissionId: item.id,
      taskId: item.taskId,
      score: Number(item.score),
      feedback: item.feedbackCategory,
      submittedAt: item.submittedAt,
      evaluatedAt: item.evaluatedAt ?? item.submittedAt,
    }));
  }

  private async assertActiveStudent(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Account is inactive');
  }
}
