import { Module } from '@nestjs/common';
import { ImitationController } from './imitation.controller';
import { ImitationService } from './imitation.service';
// SDD 3.10 - Imitation Module
@Module({
	controllers: [ImitationController],
	providers: [ImitationService],
})
export class ImitationModule {}
