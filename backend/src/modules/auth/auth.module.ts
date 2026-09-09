import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// SDD 3.2 - Authentication Module
@Module({ controllers: [AuthController], providers: [AuthService] })
export class AuthModule {}
