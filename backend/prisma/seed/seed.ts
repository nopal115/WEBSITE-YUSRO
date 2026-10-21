import { PrismaClient, UserRole, AccountStatus, ContentStatus, TaskType } from '@prisma/client';
import * as argon2 from 'argon2';
import { importYusroMaterials } from './import-yusro-materials';
import { seedCurriculumTasks } from './seed-curriculum-tasks';

const prisma = new PrismaClient();

async function ensureAdmin(): Promise<void> {
	const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@yusro.local';
	const password = process.env.SEED_ADMIN_PASSWORD;
	const name = process.env.SEED_ADMIN_NAME ?? 'Admin Pengajar';

	if (!password || password.length < 8) {
		throw new Error('SEED_ADMIN_PASSWORD must be set and contain at least 8 characters');
	}

	await prisma.user.upsert({
		where: { email },
		update: { name, role: UserRole.ADMIN, status: AccountStatus.ACTIVE },
		create: {
			email,
			name,
			password: await argon2.hash(password),
			role: UserRole.ADMIN,
			status: AccountStatus.ACTIVE,
		},
	});
}

async function ensureDemoContent(): Promise<void> {
	const existingStageCount = await prisma.stage.count({ where: { status: ContentStatus.ACTIVE } });
	if (existingStageCount > 0) return;

	const audio = await prisma.audioAsset.create({
		data: {
			type: 'REFERENCE',
			status: 'ACTIVE',
			originalName: 'demo-reference.mp3',
			objectKey: 'seed/demo-reference.mp3',
			mimeType: 'audio/mpeg',
			sizeBytes: 1024,
			durationSeconds: 12,
		},
	});

	const stage = await prisma.stage.create({
		data: {
			title: 'Tahap 1 - Pengenalan Huruf',
			description: 'Materi pembuka untuk mengenal huruf dan pengucapan dasar.',
			order: 1,
			status: ContentStatus.ACTIVE,
		},
	});

	const material1 = await prisma.material.create({
		data: {
			stageId: stage.id,
			title: 'Materi 1 - Huruf Hijaiyah Dasar',
			contentText: 'Pada materi ini santri akan mengenal huruf hijaiyah dasar dengan pelafalan yang jelas dan berulang.',
			order: 1,
			isRequired: true,
			status: ContentStatus.ACTIVE,
		},
	});

	const material2 = await prisma.material.create({
		data: {
			stageId: stage.id,
			title: 'Materi 2 - Bacaan Sederhana',
			contentText: 'Setelah memahami huruf, santri akan memulai latihan membaca kata-kata pendek.',
			order: 2,
			isRequired: true,
			status: ContentStatus.ACTIVE,
		},
	});

	await prisma.task.create({
		data: {
			stageId: stage.id,
			materialId: material1.id,
			title: 'Quiz Pendahuluan',
			type: TaskType.QUIZ,
			status: ContentStatus.ACTIVE,
			order: 1,
			referenceAudioId: audio.id,
			questions: {
				create: {
					prompt: 'Huruf mana yang sesuai dengan bunyi “a”?',
					order: 1,
					options: {
						create: [
							{ text: 'Alif', isCorrect: true },
							{ text: 'Ba', isCorrect: false },
							{ text: 'Ta', isCorrect: false },
						],
					},
				},
			},
		},
	});

	await prisma.task.create({
		data: {
			stageId: stage.id,
			materialId: material2.id,
			title: 'Latihan Meniru',
			type: TaskType.IMITATION,
			status: ContentStatus.ACTIVE,
			order: 2,
			referenceAudioId: audio.id,
		},
	});
}

async function main(): Promise<void> {
	await ensureAdmin();
	await importYusroMaterials(prisma);
	await seedCurriculumTasks(prisma);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
