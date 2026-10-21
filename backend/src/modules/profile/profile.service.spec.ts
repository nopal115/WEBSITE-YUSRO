import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new ProfileService(mockPrisma as unknown as PrismaService);
  });

  describe('getProfile', () => {
    it('mengembalikan profil pengguna beserta studentCode dan joinedAt', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        studentId: 'YSR-000137',
        email: 'ahmad@example.com',
        name: 'Ahmad Fauzi',
        role: 'SANTRI',
        status: 'ACTIVE',
        createdAt: new Date('2026-08-01T02:00:00.000Z'),
        updatedAt: new Date('2026-08-01T02:00:00.000Z'),
      });

      const profile = await service.getProfile('u-1');

      expect(profile.studentCode).toBe('YSR-000137');
      expect(profile.joinedAt).toBe('2026-08-01T02:00:00.000Z');
      expect(profile.name).toBe('Ahmad Fauzi');
    });

    it('melempar NotFoundException bila user tidak ditemukan', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('changePassword', () => {
    it('menolak bila konfirmasi password tidak cocok', async () => {
      await expect(
        service.changePassword('u-1', 'Lama1234', 'Baru1234', 'Salah1234'),
      ).rejects.toThrow(BadRequestException);
    });

    it('menolak bila password baru lemah (kurang dari 8 karakter atau tanpa angka)', async () => {
      await expect(
        service.changePassword('u-1', 'Lama1234', 'hanyahuruf', 'hanyahuruf'),
      ).rejects.toThrow('AUTH_WEAK_PASSWORD');
    });

    it('menolak bila password lama salah', async () => {
      const currentHashed = await argon2.hash('PasswordBenar123');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        password: currentHashed,
      });

      await expect(
        service.changePassword('u-1', 'PasswordSalah123', 'PasswordBaru123', 'PasswordBaru123'),
      ).rejects.toThrow('Password lama tidak sesuai.');
    });

    it('berhasil memperbarui password bila password lama benar dan password baru kuat', async () => {
      const currentHashed = await argon2.hash('PasswordBenar123');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        password: currentHashed,
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'u-1' });

      const result = await service.changePassword('u-1', 'PasswordBenar123', 'PasswordBaru123', 'PasswordBaru123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password berhasil diubah.');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { password: expect.any(String) },
      });
    });
  });
});
