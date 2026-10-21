import { NotFoundException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { LearningService } from '../learning/learning.service';
import { ProgressService } from '../progress/progress.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let mockPrisma: any;
  let mockLearningService: Partial<Record<keyof LearningService, jest.Mock>>;
  let mockProgressService: Partial<Record<keyof ProgressService, jest.Mock>>;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      materialProgress: {
        findFirst: jest.fn(),
      },
      attempt: {
        findFirst: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
      },
    };

    mockLearningService = {
      getContinue: jest.fn(),
    };

    mockProgressService = {
      getProgress: jest.fn(),
    };

    service = new DashboardService(
      mockPrisma as unknown as PrismaService,
      mockLearningService as unknown as LearningService,
      mockProgressService as unknown as ProgressService,
    );
  });

  it('mengembalikan data ringkasan dashboard santri dengan format SDD 5.8', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Ahmad Fauzi',
      studentId: 'YSR-000137',
    });

    mockProgressService.getProgress!.mockResolvedValue({
      learningProgressPct: 52,
      materials: { completed: 9, total: 22, pct: 41 },
      tasks: { completed: 8, total: 18, pct: 44 },
    });

    mockLearningService.getContinue!.mockResolvedValue({
      materialId: 'mat-next',
      materialTitle: 'Kasrah',
      stageTitle: 'Tahapan 2 — Harakat',
    });

    mockPrisma.materialProgress.findFirst.mockResolvedValue({
      material: {
        id: 'mat-prev',
        title: 'Fathah',
        stage: { title: 'Tahapan 1 — Pengenalan Huruf' },
      },
    });

    mockPrisma.attempt.findFirst.mockResolvedValue({
      id: 'att-1',
      score: '85.00',
      submittedAt: new Date('2026-09-02T08:00:00.000Z'),
      task: { title: 'Latihan Dengar-Pilih' },
    });

    mockPrisma.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Latihan Dengar-Tirukan',
        material: { title: 'Kasrah' },
      },
    ]);

    const result = await service.getDashboardData('user-1');

    expect(result.greeting).toEqual({
      name: 'Ahmad Fauzi',
      studentCode: 'YSR-000137',
    });
    expect(result.learningProgressPct).toBe(52);
    expect(result.materialsCompleted).toBe(9);
    expect(result.tasksCompleted).toBe(8);
    expect(result.lastMaterial).toEqual({
      id: 'mat-prev',
      title: 'Fathah',
      stageTitle: 'Tahapan 1 — Pengenalan Huruf',
    });
    expect(result.lastAttemptScore).toEqual({
      score: 85,
      taskTitle: 'Latihan Dengar-Pilih',
      submittedAt: '2026-09-02T08:00:00.000Z',
    });
    expect(result.unfinishedTasks).toEqual([
      { id: 'task-1', title: 'Latihan Dengar-Tirukan', materialTitle: 'Kasrah' },
    ]);
    expect(result.continueTarget).toEqual({ materialId: 'mat-next' });
  });

  it('melempar NotFoundException bila santri tidak ditemukan', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getDashboardData('non-existent')).rejects.toThrow(NotFoundException);
  });
});
