import { Module } from '@nestjs/common';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
// SDD 3.6 - Audio Module
@Module({ controllers: [AudioController], providers: [AudioService] })
export class AudioModule {}
