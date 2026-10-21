import { EvaluationStatus, TaskType } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { AdminMonitoringService } from './admin-monitoring.service';

describe('AdminMonitoringService', () => {
	const createService = () => {
		const prisma = {
			attempt: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
			task: { findMany: jest.fn() },
		};
		const storage = { getSignedGetUrl: jest.fn() };
		return { service: new AdminMonitoringService(prisma as never, storage as never), prisma, storage };
	};

	it('returns paginated imitation submissions in the frontend response shape', async () => {
		const { service, prisma } = createService();
		const submittedAt = new Date('2026-10-19T00:00:00Z');
		prisma.attempt.findMany.mockResolvedValue([{
			id: 'submission-1',
			attemptNo: 2,
			userId: 'student-1',
			taskId: 'task-1',
			evaluationStatus: EvaluationStatus.EVALUATED,
			score: 92.5,
			feedbackCategory: 'SANGAT_BAIK',
			submittedAt,
			evaluatedAt: submittedAt,
			failedAt: null,
			user: { studentId: 'YSR-000001', name: 'Santri Demo' },
			task: { title: 'Latihan Meniru', material: { title: 'Materi 1' } },
		}]);
		prisma.attempt.count.mockResolvedValue(21);

		await expect(service.listSubmissions({
			status: EvaluationStatus.EVALUATED,
			taskId: 'task-1',
			studentId: 'student-1',
			from: '2026-10-01',
			to: '2026-10-19',
			page: 2,
			limit: 20,
		})).resolves.toEqual({
			data: [{
				submissionId: 'submission-1',
				attemptNo: 2,
				studentId: 'student-1',
				studentCode: 'YSR-000001',
				studentName: 'Santri Demo',
				taskId: 'task-1',
				taskTitle: 'Latihan Meniru',
				materialTitle: 'Materi 1',
				evaluationStatus: EvaluationStatus.EVALUATED,
				score: 92.5,
				feedbackCategory: 'SANGAT_BAIK',
				submittedAt: submittedAt.toISOString(),
				evaluatedAt: submittedAt.toISOString(),
				failedAt: null,
			}],
			meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
		});
		expect(prisma.attempt.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({
				taskType: TaskType.IMITATION,
				evaluationStatus: EvaluationStatus.EVALUATED,
				taskId: 'task-1',
				userId: 'student-1',
				submittedAt: {
					gte: new Date('2026-10-01T00:00:00.000Z'),
					lt: new Date('2026-10-20T00:00:00.000Z'),
				},
			}),
			skip: 20,
			take: 20,
		}));
	});

	it('returns a short-lived recording URL and rejects missing recordings', async () => {
		const { service, prisma, storage } = createService();
		prisma.attempt.findFirst.mockResolvedValue({ recordingAudio: { objectKey: 'recordings/student/demo.wav' } });
		storage.getSignedGetUrl.mockResolvedValue('https://storage.example/audio');

		await expect(service.getRecordingUrl('submission-1')).resolves.toEqual({
			url: 'https://storage.example/audio',
			expiresInSeconds: 300,
		});
		expect(storage.getSignedGetUrl).toHaveBeenCalledWith('recordings/student/demo.wav', 300);

		prisma.attempt.findFirst.mockResolvedValue(null);
		await expect(service.getRecordingUrl('missing')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('lists only active tasks and includes the material label for filters', async () => {
		const { service, prisma } = createService();
		prisma.task.findMany.mockResolvedValue([{
			id: 'task-1',
			title: 'Latihan Meniru',
			type: TaskType.IMITATION,
			status: 'ACTIVE',
			material: { title: 'Materi 1' },
		}]);

		await expect(service.getTasks(TaskType.IMITATION)).resolves.toEqual([{
			id: 'task-1',
			title: 'Latihan Meniru',
			type: TaskType.IMITATION,
			materialTitle: 'Materi 1',
			status: 'ACTIVE',
		}]);
		expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: { type: TaskType.IMITATION, status: 'ACTIVE' },
		}));
	});
});
