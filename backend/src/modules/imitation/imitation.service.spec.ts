import { BadRequestException } from '@nestjs/common';
import { AccountStatus, TaskType } from '@prisma/client';
import { ImitationService } from './imitation.service';

describe('ImitationService', () => {
	const createService = () => {
		const prisma = {
			user: { findUnique: jest.fn() },
			task: { findFirst: jest.fn() },
			attempt: { findMany: jest.fn() },
		};
		const storage = { putObject: jest.fn(), deleteObject: jest.fn(), getSignedGetUrl: jest.fn() };
		const audioProcessing = { getMetadata: jest.fn(), getVolumeStats: jest.fn() };
		return { service: new ImitationService(prisma as never, storage as never, audioProcessing as never), prisma, storage };
	};

	it('rejects a spoofed WAV upload before touching storage or the database', async () => {
		const { service, storage } = createService();

		await expect(service.submitRecording('user-1', 'task-1', {
			buffer: Buffer.from('not a wav'), size: 9, mimetype: 'audio/wav', originalname: 'recording.wav',
		} as Express.Multer.File)).rejects.toBeInstanceOf(BadRequestException);
		expect(storage.putObject).not.toHaveBeenCalled();
	});

	it('returns a short-lived reference URL only for an active imitation task', async () => {
		const { service, prisma, storage } = createService();
		prisma.user.findUnique.mockResolvedValue({ status: AccountStatus.ACTIVE });
		prisma.task.findFirst.mockResolvedValue({
			id: 'task-1', title: 'Repeat', order: 1, stageId: 'stage-1', materialId: 'material-1',
			referenceAudio: { id: 'audio-1', originalName: 'reference.wav', durationSeconds: 3, objectKey: 'reference/audio-1.wav' },
		});
		storage.getSignedGetUrl.mockResolvedValue('https://storage.example/reference?signature=short-lived');

		await expect(service.getTask('user-1', 'task-1')).resolves.toMatchObject({
			id: 'task-1', referenceAudio: { id: 'audio-1', url: expect.stringContaining('signature=short-lived') },
		});
		expect(prisma.task.findFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({ id: 'task-1', type: TaskType.IMITATION, status: 'ACTIVE' }),
		}));
	});
});
