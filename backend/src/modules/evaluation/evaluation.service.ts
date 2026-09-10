import { Injectable } from '@nestjs/common';
import { MlClientService } from '../ml-client/ml-client.service';

@Injectable()
export class EvaluationService {
	constructor(private readonly mlClient: MlClientService) {}

	async getReadiness(): Promise<{ status: 'ready'; evaluator: 'ml-service' }> {
		await this.mlClient.getHealth();
		return { status: 'ready', evaluator: 'ml-service' };
	}
}
