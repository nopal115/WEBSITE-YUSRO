import { Module } from '@nestjs/common';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
// SDD 3.13 - Progress Module
@Module({ controllers: [ProgressController], providers: [ProgressService] })
export class ProgressModule {}
