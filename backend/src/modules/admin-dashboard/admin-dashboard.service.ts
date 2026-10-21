import { Injectable } from '@nestjs/common';
import { AccountStatus, ContentStatus, EvaluationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { MlClientService } from '../ml-client/ml-client.service';

type StudentProgressData = {
	materialProgress: { materialId: string }[];
	taskProgress: { taskId: string }[];
};

type StudentAttemptData = {
	userId: string;
	taskId: string;
	submittedAt: Date;
	score: unknown;
};

type ActiveMaterial = {
	id: string;
	stageId: string;
	order: number;
	isRequired: boolean;
};

type ActiveStage = { id: string; order: number };
type ActiveTask = { id: string; stageId: string; materialId: string | null };

@Injectable()
export class AdminDashboardService {
	constructor(private readonly prisma: PrismaService, private readonly mlClient: MlClientService) {}

	async getDashboard() {
		const [
			totalStudents,
			activeStudents,
			attemptsTotal,
			materialsTotal,
			tasksTotal,
			progressData,
			evaluatedAttempts,
			queued,
			processing,
			failedLast24h,
			evaluationHealth,
		] = await Promise.all([
			this.prisma.user.count({ where: { role: UserRole.SANTRI } }),
			this.prisma.user.count({ where: { role: UserRole.SANTRI, status: AccountStatus.ACTIVE } }),
			this.prisma.attempt.count({ where: { user: { role: UserRole.SANTRI } } }),
			this.prisma.material.count({ where: { status: ContentStatus.ACTIVE } }),
			this.prisma.task.count({ where: { status: ContentStatus.ACTIVE } }),
			this.prisma.user.findMany({
				where: { role: UserRole.SANTRI },
				select: {
					id: true,
					status: true,
					materialProgress: { where: { completedAt: { not: null }, material: { status: ContentStatus.ACTIVE } }, select: { materialId: true } },
					taskProgress: { where: { completedAt: { not: null }, task: { status: ContentStatus.ACTIVE } }, select: { taskId: true } },
				},
			}),
			this.getEvaluatedAttempts(),
			this.prisma.attempt.count({ where: { evaluationStatus: EvaluationStatus.SUBMITTED } }),
			this.prisma.attempt.count({ where: { evaluationStatus: EvaluationStatus.PROCESSING } }),
			this.prisma.attempt.count({
				where: { evaluationStatus: EvaluationStatus.FAILED, failedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
			}),
			this.getEvaluationHealth(),
		]);

		const averageProgressPct = progressData.length === 0
			? 0
			: Math.round(progressData.reduce((total, student) => total + this.progressPercent(student, materialsTotal, tasksTotal), 0) / progressData.length);
		const bestScores = this.bestScoresByTask(evaluatedAttempts).map(({ score }) => score);

		return {
			totalStudents,
			activeStudents,
			attemptsTotal,
			averageScore: bestScores.length === 0 ? null : this.round2(bestScores.reduce((sum, score) => sum + score, 0) / bestScores.length),
			averageProgressPct,
			evaluation: {
				queued,
				processing,
				failedLast24h,
				serviceStatus: evaluationHealth.serviceStatus,
				modelVersion: evaluationHealth.modelVersion,
			},
		};
	}

	async getAttention() {
		const [students, stages, materials, tasks, attempts] = await Promise.all([
			this.prisma.user.findMany({
				where: { role: UserRole.SANTRI, status: AccountStatus.ACTIVE },
				orderBy: { name: 'asc' },
				select: {
					id: true,
					name: true,
					studentId: true,
					materialProgress: { where: { completedAt: { not: null }, material: { status: ContentStatus.ACTIVE } }, select: { materialId: true } },
					taskProgress: { where: { completedAt: { not: null }, task: { status: ContentStatus.ACTIVE } }, select: { taskId: true } },
				},
			}),
			this.prisma.stage.findMany({ where: { status: ContentStatus.ACTIVE }, orderBy: { order: 'asc' }, select: { id: true, order: true } }),
			this.prisma.material.findMany({
				where: { status: ContentStatus.ACTIVE },
				orderBy: [{ stage: { order: 'asc' } }, { order: 'asc' }],
				select: { id: true, stageId: true, order: true, isRequired: true },
			}),
			this.prisma.task.findMany({
				where: { status: ContentStatus.ACTIVE },
				select: { id: true, stageId: true, materialId: true },
			}),
			this.prisma.attempt.findMany({
				where: { user: { role: UserRole.SANTRI } },
				orderBy: { submittedAt: 'asc' },
				select: { userId: true, taskId: true, submittedAt: true, score: true, evaluationStatus: true },
			}),
		]);

		const materialsTotal = materials.length;
		const tasksTotal = tasks.length;
		const attemptsByStudent = this.groupBy(attempts, (attempt) => attempt.userId);
		const evaluatedByStudent = this.groupBy(
			attempts.filter((attempt) => attempt.evaluationStatus === EvaluationStatus.EVALUATED && attempt.score !== null),
			(attempt) => attempt.userId,
		);
		const scoredAttemptsByStudent = new Map<string, StudentAttemptData[]>(
			[...evaluatedByStudent].map(([userId, records]) => [userId, records]),
		);

		return students.flatMap((student) => {
			const completedMaterials = new Set(student.materialProgress.map(({ materialId }) => materialId));
			const progress = this.progressPercent(student, materialsTotal, tasksTotal);
			const reasons: string[] = [];
			const details: Record<string, number> = {};

			if (progress < 50) {
				reasons.push('LOW_PROGRESS');
				details.learningProgressPct = progress;
			}

			const availableTasks = this.countAvailableTasks(stages, materials, tasks, completedMaterials);
			const studentAttempts = attemptsByStudent.get(student.id) ?? [];
			if (availableTasks > 0 && studentAttempts.length === 0) {
				reasons.push('NO_ATTEMPT');
				details.availableTasks = availableTasks;
			}

			const bestScores = this.bestScoresByTask(scoredAttemptsByStudent.get(student.id) ?? []);
			if (bestScores.length >= 2) {
				const ordered = [...bestScores].sort((left, right) => left.lastAttemptAt.getTime() - right.lastAttemptAt.getTime());
				const previous = ordered[ordered.length - 2];
				const latest = ordered[ordered.length - 1];
				const delta = this.round2(latest.score - previous.score);
				if (delta <= -10) {
					reasons.push('SCORE_DECLINE');
					details.previousBest = previous.score;
					details.latestBest = latest.score;
					details.delta = delta;
				}
			}

			if (reasons.length === 0) return [];
			return [{
				studentId: student.id,
				studentCode: student.studentId ?? '',
				name: student.name,
				reasons,
				...details,
			}];
		});
	}

	private async getEvaluatedAttempts(): Promise<StudentAttemptData[]> {
		return this.prisma.attempt.findMany({
			where: { user: { role: UserRole.SANTRI }, evaluationStatus: EvaluationStatus.EVALUATED, score: { not: null } },
			orderBy: { submittedAt: 'asc' },
			select: { userId: true, taskId: true, submittedAt: true, score: true },
		});
	}

	private async getEvaluationHealth(): Promise<{ serviceStatus: string; modelVersion: string | null }> {
		try {
			const health = await this.mlClient.getHealth();
			return {
				serviceStatus: health.model_loaded ? 'ok' : 'loading',
				modelVersion: health.model_version || null,
			};
		} catch {
			return { serviceStatus: 'unavailable', modelVersion: null };
		}
	}

	private progressPercent(student: Pick<StudentProgressData, 'materialProgress' | 'taskProgress'>, materialsTotal: number, tasksTotal: number): number {
		const total = materialsTotal + tasksTotal;
		if (total === 0) return 0;
		return Math.round(((student.materialProgress.length + student.taskProgress.length) / total) * 100);
	}

	private countAvailableTasks(stages: ActiveStage[], materials: ActiveMaterial[], tasks: ActiveTask[], completed: Set<string>): number {
		const stageAccess = new Map<string, boolean>();
		for (const [index, stage] of stages.entries()) {
			const previous = stages[index - 1];
			const previousMaterials = previous ? materials.filter((material) => material.stageId === previous.id && material.isRequired) : [];
			stageAccess.set(stage.id, !previous || previousMaterials.every((material) => completed.has(material.id)));
		}

		const materialAccess = new Map<string, boolean>();
		for (const stage of stages) {
			if (!stageAccess.get(stage.id)) continue;
			const stageMaterials = materials.filter((material) => material.stageId === stage.id);
			for (const [index, material] of stageMaterials.entries()) {
				const previousMaterial = stageMaterials[index - 1];
				materialAccess.set(material.id, completed.has(material.id) || !previousMaterial || completed.has(previousMaterial.id));
			}
		}

		return tasks.filter((task) => {
			if (!stageAccess.get(task.stageId)) return false;
			if (task.materialId === null) return true;
			return materialAccess.get(task.materialId) === true;
		}).length;
	}

	private bestScoresByTask(attempts: StudentAttemptData[]): { taskId: string; score: number; lastAttemptAt: Date }[] {
		const best = new Map<string, { taskId: string; score: number; lastAttemptAt: Date }>();
		for (const attempt of attempts) {
			const score = Number(attempt.score);
			const current = best.get(attempt.taskId);
			if (!current || score >= current.score) {
				best.set(attempt.taskId, { taskId: attempt.taskId, score, lastAttemptAt: attempt.submittedAt });
			}
		}
		return [...best.values()];
	}

	private groupBy<T>(items: T[], keyFor: (item: T) => string): Map<string, T[]> {
		const result = new Map<string, T[]>();
		for (const item of items) {
			const key = keyFor(item);
			const group = result.get(key) ?? [];
			group.push(item);
			result.set(key, group);
		}
		return result;
	}

	private round2(value: number): number {
		return Math.round(value * 100) / 100;
	}
}
