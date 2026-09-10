import { Module } from '@nestjs/common';
import { ImitationController } from './imitation.controller';
import { ImitationService } from './imitation.service';
import { MlClientModule } from '../ml-client/ml-client.module';
// SDD 3.10 - Imitation Module
@Module({
	imports: [MlClientModule],
	controllers: [ImitationController],
	providers: [ImitationService],
})
export class ImitationModule {}
