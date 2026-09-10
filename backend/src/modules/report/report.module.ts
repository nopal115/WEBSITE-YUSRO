import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { StatisticsModule } from '../statistics/statistics.module';
// SDD 3.15 - Report Module
@Module({ imports: [StatisticsModule], controllers: [ReportController], providers: [ReportService] })
export class ReportModule {}
