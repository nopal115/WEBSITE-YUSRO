import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

// SDD 3.4 - Profile Module
@Module({ controllers: [ProfileController], providers: [ProfileService] })
export class ProfileModule {}
