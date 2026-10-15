import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class StudentAdminService {
  constructor(private readonly prisma: PrismaService) {}

  listStudents(search?: string) {
    const query = search?.trim();
    return this.prisma.user.findMany({
      where: {
        role: UserRole.SANTRI,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' as const } },
                { email: { contains: query, mode: 'insensitive' as const } },
                { studentId: { contains: query, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 100,
      select: {
        id: true,
        studentId: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async setStudentStatus(studentId: string, status: AccountStatus) {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, role: UserRole.SANTRI },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    return this.prisma.user.update({
      where: { id: studentId },
      data: { status },
      select: {
        id: true,
        studentId: true,
        email: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });
  }
}
