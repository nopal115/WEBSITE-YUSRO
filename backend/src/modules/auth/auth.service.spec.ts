import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserService: Partial<Record<keyof UserService, jest.Mock>>;
  let mockJwtService: Partial<Record<keyof JwtService, jest.Mock>>;
  let mockPrismaService: any;

  beforeEach(() => {
    mockUserService = {
      findByEmail: jest.fn(),
      findPublicById: jest.fn(),
      create: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    mockPrismaService = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      passwordResetToken: {
        create: jest.fn().mockResolvedValue({ id: 'prt-1' }),
        findFirst: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'prt-1' }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'u-1' }),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrismaService)),
    };

    service = new AuthService(
      mockUserService as unknown as UserService,
      mockJwtService as unknown as JwtService,
      mockPrismaService as unknown as PrismaService,
    );
  });

  describe('forgotPassword', () => {
    it('mengembalikan pesan sukses seragam dan membuat token reset jika email ada', async () => {
      mockUserService.findByEmail!.mockResolvedValue({
        id: 'user-123',
        email: 'santri@example.com',
        status: AccountStatus.ACTIVE,
      });

      const result = await service.forgotPassword({ email: 'santri@example.com' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Jika email terdaftar, tautan reset telah dikirim.');
      expect(mockPrismaService.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(mockPrismaService.passwordResetToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('tetap mengembalikan respons seragam bila email tidak ditemukan tanpa melempar error', async () => {
      mockUserService.findByEmail!.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'unknown@example.com' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Jika email terdaftar, tautan reset telah dikirim.');
      expect(mockPrismaService.passwordResetToken.create).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('menolak bila konfirmasi password tidak cocok', async () => {
      await expect(
        service.resetPassword({
          token: 'some-token',
          password: 'Password123',
          passwordConfirmation: 'Different123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('menolak bila token reset tidak ditemukan atau kedaluwarsa', async () => {
      mockPrismaService.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'invalid-token',
          password: 'Password123',
          passwordConfirmation: 'Password123',
        }),
      ).rejects.toThrow('AUTH_RESET_INVALID');
    });

    it('memperbarui password dan membatalkan refresh token lama bila token valid', async () => {
      const rawToken = 'valid-token-123';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      mockPrismaService.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-rec-1',
        userId: 'user-123',
        tokenHash,
        expiresAt: new Date(Date.now() + 100000),
        usedAt: null,
      });

      const result = await service.resetPassword({
        token: rawToken,
        password: 'NewPassword123',
        passwordConfirmation: 'NewPassword123',
      });

      expect(result.success).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { password: expect.any(String) },
      });
      expect(mockPrismaService.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'token-rec-1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });
  });

  describe('getMe', () => {
    it('mengembalikan data publik pengguna beserta studentCode', async () => {
      mockUserService.findPublicById!.mockResolvedValue({
        id: 'u-1',
        studentId: 'YSR-000001',
        studentCode: 'YSR-000001',
        email: 'santri@example.com',
        name: 'Santri Satu',
        role: UserRole.SANTRI,
        status: AccountStatus.ACTIVE,
      });

      const user = await service.getMe('u-1');

      expect(user).toBeDefined();
      expect(user.studentCode).toBe('YSR-000001');
    });

    it('melempar UnauthorizedException bila user tidak ditemukan', async () => {
      mockUserService.findPublicById!.mockResolvedValue(null);

      await expect(service.getMe('unknown-id')).rejects.toThrow(UnauthorizedException);
    });
  });
});
