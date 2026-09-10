import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, ContentStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class ProgressService {
	constructor(private readonly prisma: PrismaService) {}

	async getProgress(userId: string) {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
		if (!user) throw new NotFoundException('User not found');
		if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Account is inactive');

		const [totalMaterials, completedMaterials, totalTasks, completedTasks] = await Promise.all([
			this.prisma.material.count({ where: { status: ContentStatus.ACTIVE } }),
			this.prisma.materialProgress.count({
				where: { userId, completedAt: { not: null }, material: { status: ContentStatus.ACTIVE } },
			}),
			this.prisma.task.count({ where: { status: ContentStatus.ACTIVE } }),
			this.prisma.taskProgress.count({
				where: { userId, completedAt: { not: null }, task: { status: ContentStatus.ACTIVE } },
			}),
		]);
		const totalActivities = totalMaterials + totalTasks;
		const completedActivities = completedMaterials + completedTasks;

		return {
			materials: { completed: completedMaterials, total: totalMaterials },
			tasks: { completed: completedTasks, total: totalTasks },
			progress: totalActivities === 0 ? 0 : Math.round((completedActivities / totalActivities) * 100),
		};
	}
}
