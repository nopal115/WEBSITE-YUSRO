import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

// SDD 3.3 - User Module
@Module({ controllers: [UserController], providers: [UserService] })
export class UserModule {}
