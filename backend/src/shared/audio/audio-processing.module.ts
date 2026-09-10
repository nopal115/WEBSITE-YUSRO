import { Global, Module } from '@nestjs/common';
import { AudioProcessingService } from './audio-processing.service';

@Global()
@Module({
  providers: [AudioProcessingService],
  exports: [AudioProcessingService],
})
export class AudioProcessingModule {}
