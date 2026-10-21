import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, EvaluationStatus, FeedbackCategory, Prisma, TaskType } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';

const RECORDING_URL_SECONDS = 300;

type SubmissionFilters = {
	status?: EvaluationStatus;
	taskId?: string;
	studentId?: string;
	from?: string;
	to?: string;
	page: number;
	limit: number;
};

@Injectable()
export class AdminMonitoringService {
	constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

	async listSubmissions(filters: SubmissionFilters) {
		const where = this.submissionWhere(filters);
		const [attempts, total] = await Promise.all([
			this.prisma.attempt.findMany({
				where,
				orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
				skip: (filters.page - 1) * filters.limit,
				take: filters.limit,
				include: {
					user: { select: { studentId: true, name: true } },
					task: { select: { title: true, material: { select: { title: true } } } },
				},
			}),
			this.prisma.attempt.count({ where }),
		]);

		return {
			data: attempts.map((attempt) => this.toSubmission(attempt)),
			meta: {
				page: filters.page,
				limit: filters.limit,
				total,
				totalPages: Math.max(1, Math.ceil(total / filters.limit)),
			},
		};
	}

	async getSubmission(submissionId: string) {
		const attempt = await this.prisma.attempt.findFirst({
			where: { id: submissionId, taskType: TaskType.IMITATION },
			include: {
				user: { select: { studentId: true, name: true } },
				task: { select: { title: true, material: { select: { title: true } } } },
			},
		});
		if (!attempt) throw new NotFoundException('Submission not found');
		return { ...this.toSubmission(attempt), errorCode: attempt.errorCode };
	}

	async getRecordingUrl(submissionId: string) {
		const attempt = await this.prisma.attempt.findFirst({
			where: { id: submissionId, taskType: TaskType.IMITATION },
			select: { recordingAudio: { select: { objectKey: true } } },
		});
		if (!attempt?.recordingAudio) throw new NotFoundException('Recording not found');
		return {
			url: await this.storage.getSignedGetUrl(attempt.recordingAudio.objectKey, RECORDING_URL_SECONDS),
			expiresInSeconds: RECORDING_URL_SECONDS,
		};
	}

	async gradeSubmission(
		submissionId: string,
		dto: { score: number; feedbackCategory?: FeedbackCategory; notes?: string },
	) {
		const attempt = await this.prisma.attempt.findFirst({
			where: { id: submissionId, taskType: TaskType.IMITATION },
			include: { user: true, task: true },
		});
		if (!attempt) throw new NotFoundException('Submission not found');

		const score = Math.max(0, Math.min(100, Math.round(Number(dto.score))));
		let feedbackCategory = dto.feedbackCategory;
		if (!feedbackCategory) {
			if (score >= 90) feedbackCategory = FeedbackCategory.SANGAT_BAIK;
			else if (score >= 80) feedbackCategory = FeedbackCategory.BAIK;
			else if (score >= 70) feedbackCategory = FeedbackCategory.CUKUP;
			else feedbackCategory = FeedbackCategory.PERLU_LATIHAN;
		}

		const updated = await this.prisma.attempt.update({
			where: { id: submissionId },
			data: {
				evaluationStatus: EvaluationStatus.EVALUATED,
				score: new Prisma.Decimal(score),
				feedbackCategory,
				evaluatedAt: new Date(),
				failedAt: null,
				errorCode: null,
			},
			include: {
				user: { select: { studentId: true, name: true } },
				task: { select: { title: true, material: { select: { title: true } } } },
			},
		});

		// Update TaskProgress
		const progress = await this.prisma.taskProgress.findUnique({
			where: { userId_taskId: { userId: attempt.userId, taskId: attempt.taskId } },
		});
		const isHigher = !progress?.bestScore || score > Number(progress.bestScore);
		await this.prisma.taskProgress.upsert({
			where: { userId_taskId: { userId: attempt.userId, taskId: attempt.taskId } },
			update: {
				completedAt: score >= 70 ? (progress?.completedAt ?? new Date()) : progress?.completedAt,
				lastAttemptAt: new Date(),
				...(isHigher ? { bestScore: new Prisma.Decimal(score) } : {}),
			},
			create: {
				userId: attempt.userId,
				taskId: attempt.taskId,
				completedAt: score >= 70 ? new Date() : null,
				firstAttemptAt: new Date(),
				lastAttemptAt: new Date(),
				attemptCount: 1,
				bestScore: new Prisma.Decimal(score),
			},
		});

		return this.toSubmission(updated);
	}

	async getTasks(type?: TaskType) {
		const tasks = await this.prisma.task.findMany({
			where: { ...(type ? { type } : {}), status: ContentStatus.ACTIVE },
			orderBy: [{ title: 'asc' }, { id: 'asc' }],
			select: { id: true, title: true, type: true, status: true, material: { select: { title: true } } },
		});
		return tasks.map((task) => ({
			id: task.id,
			title: task.title,
			type: task.type,
			materialTitle: task.material?.title ?? '',
			status: task.status,
		}));
	}

	private submissionWhere(filters: SubmissionFilters) {
		return {
			taskType: TaskType.IMITATION,
			...(filters.status ? { evaluationStatus: filters.status } : {}),
			...(filters.taskId ? { taskId: filters.taskId } : {}),
			...(filters.studentId ? { userId: filters.studentId } : {}),
			...(filters.from || filters.to
				? {
						submittedAt: {
							...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
							...(filters.to ? { lt: new Date(new Date(`${filters.to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000) } : {}),
						},
					}
				: {}),
		};
	}

	private toSubmission(attempt: {
		id: string;
		attemptNo: number;
		userId: string;
		taskId: string;
		evaluationStatus: EvaluationStatus | null;
		score: unknown;
		feedbackCategory: unknown;
		submittedAt: Date;
		evaluatedAt: Date | null;
		failedAt: Date | null;
		user: { studentId: string | null; name: string };
		task: { title: string; material: { title: string } | null };
	}) {
		return {
			submissionId: attempt.id,
			attemptNo: attempt.attemptNo,
			studentId: attempt.userId,
			studentCode: attempt.user.studentId ?? '',
			studentName: attempt.user.name,
			taskId: attempt.taskId,
			taskTitle: attempt.task.title,
			materialTitle: attempt.task.material?.title ?? '',
			evaluationStatus: attempt.evaluationStatus ?? EvaluationStatus.SUBMITTED,
			score: attempt.score === null ? null : Number(attempt.score),
			feedbackCategory: attempt.feedbackCategory,
			submittedAt: attempt.submittedAt.toISOString(),
			evaluatedAt: attempt.evaluatedAt?.toISOString() ?? null,
			failedAt: attempt.failedAt?.toISOString() ?? null,
		};
	}
}
