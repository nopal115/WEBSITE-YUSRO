import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
import { MlClientModule } from '../ml-client/ml-client.module';
// SDD 3.11 - Evaluation Module
@Module({
	imports: [ScheduleModule.forRoot(), MlClientModule],
	controllers: [EvaluationController],
	providers: [EvaluationService],
})
export class EvaluationModule {}
