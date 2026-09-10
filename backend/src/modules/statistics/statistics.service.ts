import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, ContentStatus, EvaluationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class StatisticsService {
	constructor(private readonly prisma: PrismaService) {}

	async getStudentStatistics(userId: string) {
		await this.assertActiveStudent(userId);
		return this.buildStatistics(userId);
	}

	async getStudentHistory(userId: string) {
		await this.assertActiveStudent(userId);
		return this.getValidHistory(userId);
	}

	async getStudentOverviewForAdmin() {
		const students = await this.prisma.user.findMany({
			where: { role: UserRole.SANTRI },
			select: { id: true, studentId: true, name: true, email: true, status: true },
			orderBy: { name: 'asc' },
		});
		return Promise.all(students.map(async (student) => ({
			...student,
			statistics: await this.buildStatistics(student.id),
		})));
	}

	private async buildStatistics(userId: string) {
		const [totalMaterials, completedMaterials, totalTasks, completedTasks, history] = await Promise.all([
			this.prisma.material.count({ where: { status: ContentStatus.ACTIVE } }),
			this.prisma.materialProgress.count({ where: { userId, completedAt: { not: null }, material: { status: ContentStatus.ACTIVE } } }),
			this.prisma.task.count({ where: { status: ContentStatus.ACTIVE } }),
			this.prisma.taskProgress.count({ where: { userId, completedAt: { not: null }, task: { status: ContentStatus.ACTIVE } } }),
			this.getValidHistory(userId),
		]);
		const bestByTask = new Map<string, number>();
		for (const item of history) {
			bestByTask.set(item.taskId, Math.max(bestByTask.get(item.taskId) ?? 0, item.score));
		}
		const bestScores = [...bestByTask.values()];
		const totalActivities = totalMaterials + totalTasks;
		return {
			materialsCompleted: completedMaterials,
			tasksCompleted: completedTasks,
			progress: totalActivities === 0 ? 0 : Math.round(((completedMaterials + completedTasks) / totalActivities) * 100),
			averageScore: bestScores.length === 0 ? null : Math.round((bestScores.reduce((sum, score) => sum + score, 0) / bestScores.length) * 100) / 100,
			bestScore: bestScores.length === 0 ? null : Math.max(...bestScores),
			validEvaluationCount: history.length,
		};
	}

	private getValidHistory(userId: string) {
		return this.prisma.evaluation.findMany({
			where: { submission: { userId, status: EvaluationStatus.EVALUATED }, score: { not: null } },
			select: {
				score: true,
				feedback: true,
				evaluatedAt: true,
				submission: { select: { id: true, taskId: true, submittedAt: true } },
			},
			orderBy: { evaluatedAt: 'asc' },
		}).then(items => items.map(item => ({
			submissionId: item.submission.id,
			taskId: item.submission.taskId,
			score: item.score as number,
			feedback: item.feedback,
			submittedAt: item.submission.submittedAt,
			evaluatedAt: item.evaluatedAt,
		})));
	}

	private async assertActiveStudent(userId: string): Promise<void> {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
		if (!user) throw new NotFoundException('User not found');
		if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Account is inactive');
	}
}
