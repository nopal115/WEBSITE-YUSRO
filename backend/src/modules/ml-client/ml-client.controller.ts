import { Controller, Get } from '@nestjs/common';
import { MlClientService } from './ml-client.service';

@Controller('ml-client')
export class MlClientController {
	constructor(private readonly mlClientService: MlClientService) {}

	@Get('health')
	getHealth() {
		return this.mlClientService.getHealth();
	}
}
