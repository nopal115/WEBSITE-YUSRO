import { Injectable } from '@nestjs/common';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { UserService } from '../user/user.service';
import { AccountStatus, UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterDto) {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ConflictException('Email is already registered');
    const user = await this.users.create(
      input.email,
      await argon2.hash(input.password),
      input.name,
    );
    return this.issueToken(user.id, user.email, user);
  }

  async login(input: LoginDto) {
    const user = await this.users.findByEmail(input.email);
    if (!user || !(await argon2.verify(user.password, input.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueToken(user.id, user.email, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  private issueToken(
    id: string,
    email: string,
    user: Record<string, unknown> & { role: UserRole; status: AccountStatus },
  ) {
    return {
      accessToken: this.jwt.sign({ sub: id, email, role: user.role, status: user.status }),
      user,
    };
  }
}
