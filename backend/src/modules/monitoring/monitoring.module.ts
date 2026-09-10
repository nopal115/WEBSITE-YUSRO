import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { MlClientModule } from '../ml-client/ml-client.module';
import { StatisticsModule } from '../statistics/statistics.module';
// SDD 3.17 - Monitoring Module
@Module({
	imports: [MlClientModule, StatisticsModule],
	controllers: [MonitoringController],
	providers: [MonitoringService],
})
export class MonitoringModule {}
