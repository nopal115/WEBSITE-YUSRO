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

	it('returns the active-evaluation error code before storage side effects', async () => {
		const { service, prisma, storage } = createService();
		const tx = {
			$queryRaw: jest.fn(),
			user: { findUnique: jest.fn().mockResolvedValue({ status: AccountStatus.ACTIVE }) },
			task: { findFirst: jest.fn().mockResolvedValue({ id: 'task-1', referenceAudioId: 'reference-1' }) },
			attempt: { findFirst: jest.fn().mockResolvedValue({ id: 'active-attempt' }) },
		};
		(prisma as never as { $transaction: jest.Mock }).$transaction = jest.fn((callback) => callback(tx));
		(prisma as never as { storageOrphan: { upsert: jest.Mock } }).storageOrphan = { upsert: jest.fn() };
		const audioProcessing = (service as never as { audioProcessing: { getMetadata: jest.Mock; getVolumeStats: jest.Mock } }).audioProcessing;
		audioProcessing.getMetadata.mockResolvedValue({ format: { duration: 2, format_name: 'wav' }, streams: [{ codec_type: 'audio', codec_name: 'pcm_s16le', sample_rate: 16000, channels: 1, bits_per_sample: 16 }] });
		audioProcessing.getVolumeStats.mockResolvedValue({ maxDbfs: -10 });

		await expect(service.submitRecording('user-1', 'task-1', {
			buffer: Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt '), size: 16, mimetype: 'audio/wav', originalname: 'recording.wav',
		} as Express.Multer.File)).rejects.toMatchObject({ response: expect.objectContaining({ error_code: 'IMITATION_ACTIVE_EXISTS' }) });
		expect(storage.putObject).not.toHaveBeenCalled();
	});

	it('returns the cooldown error code before storage side effects', async () => {
		const { service, prisma, storage } = createService();
		const tx = {
			$queryRaw: jest.fn(),
			user: { findUnique: jest.fn().mockResolvedValue({ status: AccountStatus.ACTIVE }) },
			task: { findFirst: jest.fn().mockResolvedValue({ id: 'task-1', referenceAudioId: 'reference-1' }) },
			attempt: { findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ createdAt: new Date() }) },
		};
		(prisma as never as { $transaction: jest.Mock }).$transaction = jest.fn((callback) => callback(tx));
		(prisma as never as { storageOrphan: { upsert: jest.Mock } }).storageOrphan = { upsert: jest.fn() };
		const audioProcessing = (service as never as { audioProcessing: { getMetadata: jest.Mock; getVolumeStats: jest.Mock } }).audioProcessing;
		audioProcessing.getMetadata.mockResolvedValue({ format: { duration: 2, format_name: 'wav' }, streams: [{ codec_type: 'audio', codec_name: 'pcm_s16le', sample_rate: 16000, channels: 1, bits_per_sample: 16 }] });
		audioProcessing.getVolumeStats.mockResolvedValue({ maxDbfs: -10 });

		await expect(service.submitRecording('user-1', 'task-1', {
			buffer: Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt '), size: 16, mimetype: 'audio/wav', originalname: 'recording.wav',
		} as Express.Multer.File)).rejects.toMatchObject({ response: expect.objectContaining({ error_code: 'IMITATION_COOLDOWN' }) });
		expect(storage.putObject).not.toHaveBeenCalled();
	});

	it.each([1.99, 60.01])('rejects decoded duration %s seconds before storage side effects', async (duration) => {
		const { service, storage } = createService();
		const audioProcessing = (service as never as { audioProcessing: { getMetadata: jest.Mock; getVolumeStats: jest.Mock } }).audioProcessing;
		audioProcessing.getMetadata.mockResolvedValue({ format: { duration, format_name: 'wav' }, streams: [{ codec_type: 'audio', codec_name: 'pcm_s16le', sample_rate: 16000, channels: 1, bits_per_sample: 16 }] });
		audioProcessing.getVolumeStats.mockResolvedValue({ maxDbfs: -10 });

		await expect(service.submitRecording('user-1', 'task-1', {
			buffer: Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt '), size: 16, mimetype: 'audio/wav', originalname: 'recording.wav',
		} as Express.Multer.File)).rejects.toBeInstanceOf(BadRequestException);
		expect(storage.putObject).not.toHaveBeenCalled();
	});

	it('rejects a decoded WAV with an invalid PCM contract before storage side effects', async () => {
		const { service, storage } = createService();
		const audioProcessing = (service as never as { audioProcessing: { getMetadata: jest.Mock; getVolumeStats: jest.Mock } }).audioProcessing;
		audioProcessing.getMetadata.mockResolvedValue({ format: { duration: 2, format_name: 'wav' }, streams: [{ codec_type: 'audio', codec_name: 'pcm_s16le', sample_rate: 48_000, channels: 2, bits_per_sample: 16 }] });
		audioProcessing.getVolumeStats.mockResolvedValue({ maxDbfs: -10 });

		await expect(service.submitRecording('user-1', 'task-1', {
			buffer: Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt '), size: 16, mimetype: 'audio/wav', originalname: 'recording.wav',
		} as Express.Multer.File)).rejects.toBeInstanceOf(BadRequestException);
		expect(storage.putObject).not.toHaveBeenCalled();
	});

	it('rejects a silent decoded WAV before storage side effects', async () => {
		const { service, storage } = createService();
		const audioProcessing = (service as never as { audioProcessing: { getMetadata: jest.Mock; getVolumeStats: jest.Mock } }).audioProcessing;
		audioProcessing.getMetadata.mockResolvedValue({ format: { duration: 2, format_name: 'wav' }, streams: [{ codec_type: 'audio', codec_name: 'pcm_s16le', sample_rate: 16000, channels: 1, bits_per_sample: 16 }] });
		audioProcessing.getVolumeStats.mockResolvedValue({ maxDbfs: -40 });

		await expect(service.submitRecording('user-1', 'task-1', {
			buffer: Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt '), size: 16, mimetype: 'audio/wav', originalname: 'recording.wav',
		} as Express.Multer.File)).rejects.toBeInstanceOf(BadRequestException);
		expect(storage.putObject).not.toHaveBeenCalled();
	});

	it('deletes an uploaded object when the database transaction fails', async () => {
		const { service, prisma, storage } = createService();
		const tx = {
			$queryRaw: jest.fn(),
			user: { findUnique: jest.fn().mockResolvedValue({ status: AccountStatus.ACTIVE }) },
			task: { findFirst: jest.fn().mockResolvedValue({ id: 'task-1', referenceAudioId: 'reference-1' }) },
			attempt: { findFirst: jest.fn().mockResolvedValue(null), aggregate: jest.fn().mockResolvedValue({ _max: { attemptNo: 0 } }), create: jest.fn().mockRejectedValue(new Error('database failure')) },
			audioAsset: { create: jest.fn().mockResolvedValue({ id: 'recording-1' }) },
		};
		(prisma as never as { $transaction: jest.Mock }).$transaction = jest.fn((callback) => callback(tx));
		(prisma as never as { storageOrphan: { upsert: jest.Mock } }).storageOrphan = { upsert: jest.fn() };
		const audioProcessing = (service as never as { audioProcessing: { getMetadata: jest.Mock; getVolumeStats: jest.Mock } }).audioProcessing;
		audioProcessing.getMetadata.mockResolvedValue({ format: { duration: 2, format_name: 'wav' }, streams: [{ codec_type: 'audio', codec_name: 'pcm_s16le', sample_rate: 16000, channels: 1, bits_per_sample: 16 }] });
		audioProcessing.getVolumeStats.mockResolvedValue({ maxDbfs: -10 });

		await expect(service.submitRecording('user-1', 'task-1', {
			buffer: Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt '), size: 16, mimetype: 'audio/wav', originalname: 'recording.wav',
		} as Express.Multer.File)).rejects.toThrow('database failure');
		expect(storage.putObject).toHaveBeenCalledTimes(1);
		expect(storage.deleteObject).toHaveBeenCalledTimes(1);
	});
});
