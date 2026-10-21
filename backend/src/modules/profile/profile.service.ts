import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
    if (!user) throw new NotFoundException('User not found');

    return {
      ...user,
      studentCode: user.studentId ?? 'YSR-000001',
      joinedAt: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
    };
  }

  async updateProfile(userId: string, name: string) {
    const normalizedName = name.trim();
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      throw new BadRequestException('Nama harus antara 2 dan 100 karakter.');
    }
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name: normalizedName },
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
      ...updated,
      studentCode: updated.studentId ?? 'YSR-000001',
      joinedAt: updated.createdAt ? updated.createdAt.toISOString() : new Date().toISOString(),
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    passwordConfirmation: string,
  ) {
    if (newPassword !== passwordConfirmation) {
      throw new BadRequestException('Konfirmasi password baru tidak cocok.');
    }

    const hasLetter = /[A-Za-z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    if (newPassword.length < 8 || !hasLetter || !hasNumber) {
      throw new BadRequestException('AUTH_WEAK_PASSWORD');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const isMatch = await argon2.verify(user.password, currentPassword);
    if (!isMatch) {
      throw new BadRequestException('Password lama tidak sesuai.');
    }

    const hashedPassword = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return {
      success: true,
      message: 'Password berhasil diubah.',
    };
  }
}
