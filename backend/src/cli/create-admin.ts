import 'dotenv/config';
import { AccountStatus, PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || 'Admin Pengajar';

  if (!email) throw new Error('SEED_ADMIN_EMAIL must be set');
  if (!password || password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be set and contain at least 8 characters');
  }

  const prisma = new PrismaClient();
  try {
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
    console.log(`Admin account is ready for ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unable to create admin account');
  process.exitCode = 1;
});
