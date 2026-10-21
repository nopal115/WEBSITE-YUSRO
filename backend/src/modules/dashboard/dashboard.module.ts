import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { LearningModule } from '../learning/learning.module';
import { ProgressModule } from '../progress/progress.module';

@Module({
  imports: [LearningModule, ProgressModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
