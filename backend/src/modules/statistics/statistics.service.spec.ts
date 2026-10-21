import { AccountStatus, ContentStatus, EvaluationStatus, TaskType } from '@prisma/client';
import { StatisticsService } from './statistics.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('StatisticsService', () => {
  let service: StatisticsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u-1', status: AccountStatus.ACTIVE }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      material: {
        count: jest.fn().mockResolvedValue(10),
      },
      materialProgress: {
        count: jest.fn().mockResolvedValue(5),
      },
      task: {
        count: jest.fn().mockResolvedValue(10),
      },
      taskProgress: {
        count: jest.fn().mockResolvedValue(5),
      },
      attempt: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn(),
      },
    };

    service = new StatisticsService(mockPrisma as unknown as PrismaService);
  });

  describe('getStudentStatistics', () => {
    it('menghitung statistik santri mencakup rata-rata, nilai terbaik, progres, dan jumlah attempt gagal', async () => {
      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: 'att-1',
          taskId: 't-1',
          score: '80.00',
          feedbackCategory: 'BAIK',
          submittedAt: new Date('2026-09-01T00:00:00.000Z'),
          evaluatedAt: new Date('2026-09-01T00:00:10.000Z'),
        },
        {
          id: 'att-2',
          taskId: 't-1',
          score: '90.00',
          feedbackCategory: 'SANGAT_BAIK',
          submittedAt: new Date('2026-09-02T00:00:00.000Z'),
          evaluatedAt: new Date('2026-09-02T00:00:10.000Z'),
        },
        {
          id: 'att-3',
          taskId: 't-2',
          score: '70.00',
          feedbackCategory: 'CUKUP',
          submittedAt: new Date('2026-09-03T00:00:00.000Z'),
          evaluatedAt: new Date('2026-09-03T00:00:10.000Z'),
        },
      ]);

      const stats = await service.getStudentStatistics('u-1');

      expect(stats.materialsCompleted).toBe(5);
      expect(stats.tasksCompleted).toBe(5);
      expect(stats.progress).toBe(50);
      expect(stats.learningProgressPct).toBe(50);
      // bestByTask: t-1 = 90, t-2 = 70. Average of best scores: (90 + 70)/2 = 80.
      expect(stats.averageScore).toBe(80);
      expect(stats.bestScore).toBe(90);
      expect(stats.evaluatedAttempts).toBe(3);
      expect(stats.failedAttempts).toBe(1);
    });
  });

  describe('getChartData', () => {
    it('mengembalikan titik deret nilai berurutan beserta tren perkembangan (UP)', async () => {
      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: 'att-1',
          score: '60.00',
          submittedAt: new Date('2026-09-01T00:00:00.000Z'),
          task: { title: 'Tugas 1' },
        },
        {
          id: 'att-2',
          score: '75.00',
          submittedAt: new Date('2026-09-02T00:00:00.000Z'),
          task: { title: 'Tugas 2' },
        },
        {
          id: 'att-3',
          score: '85.00',
          submittedAt: new Date('2026-09-03T00:00:00.000Z'),
          task: { title: 'Tugas 3' },
        },
      ]);

      const chart = await service.getChartData('u-1');

      expect(chart.points).toHaveLength(3);
      expect(chart.points[0]).toEqual({
        sequence: 1,
        attemptId: 'att-1',
        taskTitle: 'Tugas 1',
        score: 60,
        submittedAt: '2026-09-01T00:00:00.000Z',
      });
      expect(chart.trend).toBe('UP');
    });

    it('mengembalikan INSUFFICIENT_DATA bila data nilai kurang dari 2 titik', async () => {
      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: 'att-1',
          score: '80.00',
          submittedAt: new Date('2026-09-01T00:00:00.000Z'),
          task: { title: 'Tugas 1' },
        },
      ]);

      const chart = await service.getChartData('u-1');

      expect(chart.points).toHaveLength(1);
      expect(chart.trend).toBe('INSUFFICIENT_DATA');
    });
  });
});
