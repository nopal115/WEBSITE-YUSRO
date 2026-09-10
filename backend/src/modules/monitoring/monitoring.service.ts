import { Injectable } from '@nestjs/common';
import { MlClientService } from '../ml-client/ml-client.service';
import { StatisticsService } from '../statistics/statistics.service';

@Injectable()
export class MonitoringService {
	constructor(private readonly mlClient: MlClientService, private readonly statistics: StatisticsService) {}

	async getStatus() {
		const checkedAt = new Date().toISOString();
		try {
			await this.mlClient.getHealth();
			return { status: 'ok' as const, services: { api: 'ok', ml: 'ok' }, checkedAt };
		} catch {
			return { status: 'degraded' as const, services: { api: 'ok', ml: 'unavailable' }, checkedAt };
		}
	}

	getStudents() {
		return this.statistics.getStudentOverviewForAdmin();
	}
}
