import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
// SDD 3.8 - Learning Module
@Module({ controllers: [LearningController], providers: [LearningService] })
export class LearningModule {}
