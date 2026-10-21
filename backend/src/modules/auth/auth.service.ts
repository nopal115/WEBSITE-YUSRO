import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../shared/database/prisma.service';
import { UserService } from '../user/user.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(input: RegisterDto) {
    if (input.password !== input.passwordConfirmation) {
      throw new BadRequestException('Konfirmasi password tidak cocok');
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('AUTH_EMAIL_TAKEN');
    }

    const user = await this.users.create(
      normalizedEmail,
      await argon2.hash(input.password),
      input.name.trim(),
    );

    return this.issueSession(user.id, user.email, user);
  }

  async login(input: LoginDto) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(normalizedEmail);
    if (!user || !(await argon2.verify(user.password, input.password))) {
      throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');
    }
    if (user.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('AUTH_ACCOUNT_INACTIVE');
    }

    return this.issueSession(user.id, user.email, {
      id: user.id,
      studentId: user.studentId,
      studentCode: user.studentId ?? 'YSR-000001',
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('AUTH_TOKEN_EXPIRED');

    let payload: { sub: string; type?: string };
    try {
      payload = this.jwt.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('AUTH_TOKEN_EXPIRED');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('AUTH_REFRESH_REUSED');
    }

    const records = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    const matched = await Promise.all(
      records.map(async (record) => ({ isMatch: await argon2.verify(record.tokenHash, refreshToken), record })),
    ).then((items) => items.find((item) => item.isMatch)?.record);

    if (!matched) {
      // Potensi penggunaan ulang token lama -> batalkan seluruh sesi pengguna
      await this.prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
      throw new UnauthorizedException('AUTH_REFRESH_REUSED');
    }

    const user = await this.users.findPublicById(payload.sub);
    if (!user) throw new UnauthorizedException('USER_NOT_FOUND');
    if (user.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('AUTH_ACCOUNT_INACTIVE');
    }

    await this.prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
    const nextSession = await this.createRefreshToken(payload.sub, user);

    return {
      accessToken: this.jwt.sign({ sub: payload.sub, email: user.email, role: user.role, status: user.status }),
      refreshToken: nextSession.refreshToken,
      user,
    };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { success: true, message: 'Logout berhasil.' };
  }

  async forgotPassword(input: ForgotPasswordDto) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(normalizedEmail);

    if (user && user.status === AccountStatus.ACTIVE) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 jam sesuai SDD 4.5.4

      await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const resetUrl = `${process.env.APP_PUBLIC_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
      this.logger.log(`[SIMULASI EMAIL RESET PASSWORD] Dikirim ke: ${user.email} | Tautan Reset: ${resetUrl}`);
    }

    // Selalu kembalikan respons seragam untuk mencegah enumerasi akun (SDD 5.6)
    return {
      success: true,
      message: 'Jika email terdaftar, tautan reset telah dikirim.',
      data: null,
    };
  }

  async resetPassword(input: ResetPasswordDto) {
    if (input.password !== input.passwordConfirmation) {
      throw new BadRequestException('Konfirmasi password tidak cocok');
    }

    const tokenHash = createHash('sha256').update(input.token.trim()).digest('hex');
    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!record) {
      throw new BadRequestException('AUTH_RESET_INVALID');
    }

    const hashedPassword = await argon2.hash(input.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword },
      });

      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      // Putus seluruh sesi aktif pengguna di perangkat lain
      await tx.refreshToken.deleteMany({ where: { userId: record.userId } });
    });

    return {
      success: true,
      message: 'Password berhasil diubah. Silakan masuk.',
      data: null,
    };
  }

  async getMe(userId: string) {
    const user = await this.users.findPublicById(userId);
    if (!user) throw new UnauthorizedException('USER_NOT_FOUND');
    return user;
  }

  private async issueSession(
    id: string,
    email: string,
    user: Record<string, unknown> & { id: string; email: string; role: UserRole; status: AccountStatus },
  ) {
    const refreshToken = await this.createRefreshToken(id, user);
    return {
      accessToken: this.jwt.sign({ sub: id, email, role: user.role, status: user.status }),
      refreshToken: refreshToken.refreshToken,
      user,
    };
  }

  private async createRefreshToken(userId: string, user: { email: string; role: UserRole; status: AccountStatus }) {
    const raw = this.jwt.sign(
      { sub: userId, email: user.email, role: user.role, status: user.status, type: 'refresh' },
      { expiresIn: '7d' },
    );
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tokenHash = await argon2.hash(raw);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, familyId: randomBytes(16).toString('hex'), expiresAt },
    });

    return { refreshToken: raw };
  }
}
