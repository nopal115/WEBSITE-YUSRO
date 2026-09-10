import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, ContentStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class LearningService {
	constructor(private readonly prisma: PrismaService) {}

	async getStages(userId: string) {
		await this.assertActiveUser(userId);
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
			let previousMaterialComplete = true;
			const materials = stage.materials.map((material) => {
				const completed = material.progress.some((item) => item.completedAt !== null);
				const materialUnlocked = isUnlocked && previousMaterialComplete;
				previousMaterialComplete = completed;
				return {
					id: material.id,
					title: material.title,
					order: material.order,
					isRequired: material.isRequired,
					status: material.status,
					isUnlocked: materialUnlocked,
					isCompleted: completed,
				};
			});
			previousStageComplete = stage.materials
				.filter((material) => material.isRequired)
				.every((material) => material.progress.some((item) => item.completedAt !== null));

			return {
				id: stage.id,
				title: stage.title,
				description: stage.description,
				order: stage.order,
				isUnlocked,
				materials,
			};
		});
	}

	async completeMaterial(userId: string, materialId: string) {
		await this.assertActiveUser(userId);
		const overview = await this.getStages(userId);
		const material = overview.flatMap((stage) => stage.materials).find((item) => item.id === materialId);
		if (!material) throw new NotFoundException('Material not found');
		if (!material.isUnlocked) throw new ForbiddenException('Material is locked');

		return this.prisma.materialProgress.upsert({
			where: { userId_materialId: { userId, materialId } },
			update: { completedAt: new Date() },
			create: { userId, materialId, completedAt: new Date() },
		});
	}

	private async assertActiveUser(userId: string): Promise<void> {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
		if (!user) throw new NotFoundException('User not found');
		if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Account is inactive');
	}
}
