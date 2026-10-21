import { AccountStatus, EvaluationStatus, UserRole } from '@prisma/client';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
	const createService = () => {
		const prisma = {
			user: { count: jest.fn(), findMany: jest.fn() },
			attempt: { count: jest.fn(), findMany: jest.fn() },
			material: { count: jest.fn(), findMany: jest.fn() },
			task: { count: jest.fn(), findMany: jest.fn() },
			stage: { findMany: jest.fn() },
		};
		const mlClient = { getHealth: jest.fn() };
		return { service: new AdminDashboardService(prisma as never, mlClient as never), prisma, mlClient };
	};

	it('returns summary metrics and degrades the ML status when health is unavailable', async () => {
		const { service, prisma, mlClient } = createService();
		prisma.user.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
		prisma.attempt.count
			.mockResolvedValueOnce(3)
			.mockResolvedValueOnce(1)
			.mockResolvedValueOnce(1)
			.mockResolvedValueOnce(1);
		prisma.material.count.mockResolvedValue(2);
		prisma.task.count.mockResolvedValue(2);
		prisma.user.findMany.mockResolvedValue([{
			materialProgress: [{ materialId: 'material-1' }],
			taskProgress: [{ taskId: 'task-1' }],
		}]);
		prisma.attempt.findMany.mockResolvedValue([
			{ userId: 'student-1', taskId: 'task-1', submittedAt: new Date('2026-10-01T00:00:00Z'), score: 80 },
			{ userId: 'student-1', taskId: 'task-1', submittedAt: new Date('2026-10-02T00:00:00Z'), score: 90 },
		]);
		mlClient.getHealth.mockRejectedValue(new Error('ML service unavailable'));

		await expect(service.getDashboard()).resolves.toEqual({
			totalStudents: 2,
			activeStudents: 1,
			attemptsTotal: 3,
			averageScore: 90,
			averageProgressPct: 50,
			evaluation: { queued: 1, processing: 1, failedLast24h: 1, serviceStatus: 'unavailable', modelVersion: null },
		});
	});

	it('returns active students who meet low-progress or no-attempt criteria', async () => {
		const { service, prisma } = createService();
		prisma.user.findMany.mockResolvedValue([{
			id: 'student-1',
			name: 'Santri Demo',
			studentId: 'YSR-000001',
			materialProgress: [],
			taskProgress: [],
		}]);
		prisma.stage.findMany.mockResolvedValue([{ id: 'stage-1', order: 1 }]);
		prisma.material.findMany.mockResolvedValue([{ id: 'material-1', stageId: 'stage-1', order: 1, isRequired: true }]);
		prisma.task.findMany.mockResolvedValue([{ id: 'task-1', stageId: 'stage-1', materialId: 'material-1' }]);
		prisma.attempt.findMany.mockResolvedValue([]);

		await expect(service.getAttention()).resolves.toEqual([{
			studentId: 'student-1',
			studentCode: 'YSR-000001',
			name: 'Santri Demo',
			reasons: ['LOW_PROGRESS', 'NO_ATTEMPT'],
			learningProgressPct: 0,
			availableTasks: 1,
		}]);
		expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: { role: UserRole.SANTRI, status: AccountStatus.ACTIVE },
		}));
	});

	it('reports score decline from best evaluated scores on consecutive tasks', async () => {
		const { service, prisma } = createService();
		prisma.user.findMany.mockResolvedValue([{
			id: 'student-1',
			name: 'Santri Demo',
			studentId: 'YSR-000001',
			materialProgress: [{ materialId: 'material-1' }],
			taskProgress: [],
		}]);
		prisma.stage.findMany.mockResolvedValue([{ id: 'stage-1', order: 1 }]);
		prisma.material.findMany.mockResolvedValue([{ id: 'material-1', stageId: 'stage-1', order: 1, isRequired: true }]);
		prisma.task.findMany.mockResolvedValue([]);
		prisma.attempt.findMany.mockResolvedValue([
			{ userId: 'student-1', taskId: 'task-1', submittedAt: new Date('2026-10-01T00:00:00Z'), score: 95, evaluationStatus: EvaluationStatus.EVALUATED },
			{ userId: 'student-1', taskId: 'task-2', submittedAt: new Date('2026-10-02T00:00:00Z'), score: 80, evaluationStatus: EvaluationStatus.EVALUATED },
		]);

		await expect(service.getAttention()).resolves.toEqual([{
			studentId: 'student-1',
			studentCode: 'YSR-000001',
			name: 'Santri Demo',
			reasons: ['SCORE_DECLINE'],
			previousBest: 95,
			latestBest: 80,
			delta: -15,
		}]);
	});
});
