import { PrismaClient, UserRole, AccountStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
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

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
