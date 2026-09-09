import { Module } from '@nestjs/common';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
// SDD 3.11 - Evaluation Module
@Module({ controllers: [EvaluationController], providers: [EvaluationService] })
export class EvaluationModule {}
