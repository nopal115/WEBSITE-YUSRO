import { Module } from '@nestjs/common';
import { StudentAdminController } from './student-admin.controller';
import { StudentAdminService } from './student-admin.service';
import { ProgressModule } from '../progress/progress.module';
import { StatisticsModule } from '../statistics/statistics.module';
import { ReportModule } from '../report/report.module';

// SDD 3.16 - Student Admin Module
@Module({
  imports: [ProgressModule, StatisticsModule, ReportModule],
  controllers: [StudentAdminController],
  providers: [StudentAdminService],
  exports: [StudentAdminService],
})
export class StudentAdminModule {}
