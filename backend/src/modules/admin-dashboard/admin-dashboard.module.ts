import { Module } from '@nestjs/common';
import { MlClientModule } from '../ml-client/ml-client.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

@Module({
	imports: [MlClientModule],
	controllers: [AdminDashboardController],
	providers: [AdminDashboardService],
})
export class AdminDashboardModule {}
