import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, ContentStatus, EvaluationStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class ProgressService {
	constructor(private readonly prisma: PrismaService) {}

	async getProgress(userId: string) {
		await this.assertActiveUser(userId);

		const [totalMaterials, completedMaterials, totalTasks, completedTasks, stages] = await Promise.all([
			this.prisma.material.count({ where: { status: ContentStatus.ACTIVE } }),
			this.prisma.materialProgress.count({
				where: { userId, completedAt: { not: null }, material: { status: ContentStatus.ACTIVE } },
			}),
			this.prisma.task.count({ where: { status: ContentStatus.ACTIVE } }),
			this.prisma.taskProgress.count({
				where: { userId, completedAt: { not: null }, task: { status: ContentStatus.ACTIVE } },
			}),
			this.getStageProgress(userId),
		]);

		const totalActivities = totalMaterials + totalTasks;
		const completedActivities = completedMaterials + completedTasks;
		const learningProgressPct = totalActivities === 0 ? 0 : Math.round((completedActivities / totalActivities) * 100);
		const materials = {
			completed: completedMaterials,
			total: totalMaterials,
			pct: totalMaterials === 0 ? 0 : Math.round((completedMaterials / totalMaterials) * 100),
		};
		const tasks = {
			completed: completedTasks,
			total: totalTasks,
			pct: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
		};

		return {
			learningProgressPct,
			progress: learningProgressPct,
			materials,
			tasks,
			stages,
		};
	}

	async getHistory(userId: string, page = 1, limit = 20) {
		await this.assertActiveUser(userId);
		const safePage = Math.max(1, Number(page) || 1);
		const safeLimit = Math.max(1, Number(limit) || 20);
		const skip = (safePage - 1) * safeLimit;

		const [items, total] = await Promise.all([
			this.prisma.attempt.findMany({
				where: { userId },
				include: { task: { include: { material: true } } },
				orderBy: { submittedAt: 'desc' },
				skip,
				take: safeLimit,
			}),
			this.prisma.attempt.count({ where: { userId } }),
		]);

		const data = items.map((attempt) => ({
			attemptId: attempt.id,
			taskId: attempt.taskId,
			taskTitle: attempt.task.title,
			materialTitle: attempt.task.material?.title ?? '',
			taskType: attempt.taskType,
			attemptNo: attempt.attemptNo,
			score: attempt.score === null ? null : Number(attempt.score),
			evaluationStatus: attempt.evaluationStatus ?? null,
			displayStatus: this.displayStatus(attempt.evaluationStatus),
			submittedAt: attempt.submittedAt.toISOString(),
		}));

		const totalPages = Math.max(1, Math.ceil(total / safeLimit));
		return {
			data,
			meta: { page: safePage, limit: safeLimit, total, totalPages },
		};
	}

	private async getStageProgress(userId: string) {
		const stages = await this.prisma.stage.findMany({
			where: { status: ContentStatus.ACTIVE },
			orderBy: { order: 'asc' },
			include: {
				materials: {
					where: { status: ContentStatus.ACTIVE },
					orderBy: { order: 'asc' },
					include: { progress: { where: { userId } } },
				},
			},
		});

		let previousStageComplete = true;
		return stages.map((stage) => {
			const isUnlocked = previousStageComplete;
			const total = stage.materials.length;
			const completed = stage.materials.filter((material) => material.progress.some((item) => item.completedAt !== null)).length;
			const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
			previousStageComplete = stage.materials
				.filter((material) => material.isRequired)
				.every((material) => material.progress.some((item) => item.completedAt !== null));

			return {
				id: stage.id,
				title: stage.title,
				access: isUnlocked ? 'UNLOCKED' : 'LOCKED',
				pct,
			};
		});
	}

	private displayStatus(status: EvaluationStatus | null): string {
		switch (status) {
			case EvaluationStatus.SUBMITTED:
				return 'Dikirim';
			case EvaluationStatus.PROCESSING:
				return 'Sedang diproses';
			case EvaluationStatus.EVALUATED:
				return 'Selesai';
			case EvaluationStatus.FAILED:
				return 'Gagal diproses';
			default:
				return 'Selesai';
		}
	}

	private async assertActiveUser(userId: string): Promise<void> {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
		if (!user) throw new NotFoundException('User not found');
		if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Account is inactive');
	}
}
