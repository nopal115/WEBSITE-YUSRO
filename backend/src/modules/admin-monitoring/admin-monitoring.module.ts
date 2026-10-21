import { Module } from '@nestjs/common';
import { StorageModule } from '../../shared/storage/storage.module';
import { AdminMonitoringController } from './admin-monitoring.controller';
import { AdminMonitoringService } from './admin-monitoring.service';

@Module({
	imports: [StorageModule],
	controllers: [AdminMonitoringController],
	providers: [AdminMonitoringService],
})
export class AdminMonitoringModule {}
