import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
// SDD 3.15 - Report Module
@Module({ controllers: [ReportController], providers: [ReportService] })
export class ReportModule {}
