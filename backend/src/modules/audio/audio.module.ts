import { Module } from '@nestjs/common';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
import { LocalAudioController } from './local-audio.controller';

// SDD 3.6 - Audio Module
@Module({
  controllers: [AudioController, LocalAudioController],
  providers: [AudioService],
  exports: [AudioService],
})
export class AudioModule {}

