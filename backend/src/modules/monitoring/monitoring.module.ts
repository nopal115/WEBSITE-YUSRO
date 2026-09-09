import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
// SDD 3.17 - Monitoring Module
@Module({ controllers: [MonitoringController], providers: [MonitoringService] })
export class MonitoringModule {}
