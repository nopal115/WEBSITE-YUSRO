import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AudioStatus, AudioType, ContentStatus, UserRole } from '@prisma/client';
import { AudioService } from './audio/audio.service';
import { ContentService } from './content/content.service';
import { ProfileService } from './profile/profile.service';
import { StudentAdminService } from './student-admin/student-admin.service';
import { TaskService } from './task/task.service';

describe('backend feature services', () => {
	const createPrisma = () => ({
		stage: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
		material: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
		task: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
		audioAsset: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
		user: { findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
	});

	it('returns only published content to the public content listing', async () => {
		const prisma = createPrisma();
		prisma.stage.findMany.mockResolvedValue([]);
		await new ContentService(prisma as never).listPublished();
		expect(prisma.stage.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: { status: ContentStatus.ACTIVE },
			orderBy: { order: 'asc' },
		}));
	});

	it('omits quiz correctness flags from published task listings', async () => {
		const prisma = createPrisma();
		prisma.task.findMany.mockResolvedValue([]);
		await new TaskService(prisma as never).listPublished();
		const query = prisma.task.findMany.mock.calls[0][0];
		expect(query.where.status).toBe(ContentStatus.ACTIVE);
		expect(query.select.questions.select.options.select).toEqual({ id: true, text: true });
		expect(query.select.questions.select.options.select).not.toHaveProperty('isCorrect');
	});

	it('rejects quiz questions that do not have exactly one correct option', async () => {
		const prisma = createPrisma();
		prisma.stage.findUnique.mockResolvedValue({ id: 'stage-id' });
		const service = new TaskService(prisma as never);
		await expect(service.createTask({
			stageId: 'stage-id',
			title: 'Quiz',
			type: 'QUIZ' as never,
			order: 1,
			questions: [{
				prompt: 'Question',
				order: 1,
				options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: true }],
			}],
		})).rejects.toBeInstanceOf(BadRequestException);
		expect(prisma.task.create).not.toHaveBeenCalled();
	});

	it('returns a profile without password and updates only the current user name', async () => {
		const prisma = createPrisma();
		prisma.user.findUnique.mockResolvedValue({ id: 'user-id' });
		prisma.user.update.mockResolvedValue({ id: 'user-id', name: 'New Name' });
		const service = new ProfileService(prisma as never);
		await service.updateProfile('user-id', '  New Name  ');
		expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
			where: { id: 'user-id' },
			data: { name: 'New Name' },
		}));
		expect(prisma.user.update.mock.calls[0][0].data).toEqual({ name: 'New Name' });
	});

	it('limits the admin student listing to sanitized student records', async () => {
		const prisma = createPrisma();
		prisma.user.findMany.mockResolvedValue([]);
		await new StudentAdminService(prisma as never).listStudents('  ali  ');
		const query = prisma.user.findMany.mock.calls[0][0];
		expect(query.where.role).toBe(UserRole.SANTRI);
		expect(query.where.OR).toHaveLength(3);
		expect(query.select).not.toHaveProperty('password');
		expect(query.take).toBe(100);
	});

	it('only signs URLs for active learning or reference audio', async () => {
		const prisma = createPrisma();
		const storage = { getSignedGetUrl: jest.fn().mockResolvedValue('https://storage/audio') };
		prisma.audioAsset.findFirst.mockResolvedValue({
			id: 'audio-id', originalName: 'lesson.wav', mimeType: 'audio/wav', durationSeconds: 3, objectKey: 'library/lesson',
		});
		const result = await new AudioService(prisma as never, storage as never, {} as never).getPlayableUrl('audio-id');
		expect(prisma.audioAsset.findFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: {
				id: 'audio-id',
				status: AudioStatus.ACTIVE,
				type: { in: [AudioType.LEARNING, AudioType.REFERENCE] },
			},
		}));
		expect(result.audio.url).toBe('https://storage/audio');
	});

	it('rejects references to unavailable audio instead of exposing storage internals', async () => {
		const prisma = createPrisma();
		prisma.audioAsset.findFirst.mockResolvedValue(null);
		const service = new AudioService(prisma as never, {} as never, {} as never);
		await expect(service.getPlayableUrl('missing-id')).rejects.toBeInstanceOf(NotFoundException);
	});
});
