import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findPublicById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        studentId: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return null;

    return {
      ...user,
      studentCode: user.studentId ?? 'YSR-000001',
    };
  }

  async create(email: string, password: string, name: string, role: UserRole = UserRole.SANTRI) {
    let studentId: string | undefined = undefined;

    if (role === UserRole.SANTRI) {
      const count = await this.prisma.user.count({ where: { role: UserRole.SANTRI } });
      studentId = `YSR-${String(count + 1).padStart(6, '0')}`;
    }

    const created = await this.prisma.user.create({
      data: { email, password, name, role, studentId },
      select: {
        id: true,
        studentId: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...created,
      studentCode: created.studentId ?? 'YSR-000001',
    };
  }
}
