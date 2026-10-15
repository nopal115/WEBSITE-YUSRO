import { AccountStatus, PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

function assertTestDatabase(url: string | undefined): asserts url is string {
  if (!url) throw new Error('TEST_DATABASE_URL is required; refusing to seed any other database');
  let databaseName: string;
  try {
    databaseName = new URL(url).pathname.replace(/^\/+/, '').toLowerCase();
  } catch {
    throw new Error('TEST_DATABASE_URL is invalid');
  }
  if (!/(^|[_-])test($|[_-])/.test(databaseName)) {
    throw new Error('TEST_DATABASE_URL must point to a database whose name contains a test marker');
  }
}

async function main(): Promise<void> {
  assertTestDatabase(testDatabaseUrl);
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
  const accounts = [
    { email: 'admin.test@yusro.local', name: 'Test Admin', password: 'TestAdmin-Only-2026', role: UserRole.ADMIN, status: AccountStatus.ACTIVE },
    { email: 'santri-a.test@yusro.local', name: 'Santri A', studentId: 'YSR-000001', password: 'TestSantriA-Only-2026', role: UserRole.SANTRI, status: AccountStatus.ACTIVE },
    { email: 'santri-b.test@yusro.local', name: 'Santri B', studentId: 'YSR-000002', password: 'TestSantriB-Only-2026', role: UserRole.SANTRI, status: AccountStatus.ACTIVE },
    { email: 'santri-inactive.test@yusro.local', name: 'Santri Nonaktif', studentId: 'YSR-000003', password: 'TestSantriInactive-2026', role: UserRole.SANTRI, status: AccountStatus.INACTIVE },
  ];

  try {
    for (const account of accounts) {
      const { password, ...user } = account;
      await prisma.user.upsert({
        where: { email: account.email },
        update: { ...user, password: await argon2.hash(password) },
        create: { ...user, password: await argon2.hash(password) },
      });
    }
    console.log('Created test fixtures: 1 admin, 2 active santri, 1 inactive santri.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unable to seed test database');
  process.exitCode = 1;
});
