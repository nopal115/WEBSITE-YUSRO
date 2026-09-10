import { Module } from '@nestjs/common';
import { MlClientController } from './ml-client.controller';
import { MlClientService } from './ml-client.service';
// SDD 3.12 - ML Client Module
@Module({
	controllers: [MlClientController],
	providers: [MlClientService],
	exports: [MlClientService],
})
export class MlClientModule {}
