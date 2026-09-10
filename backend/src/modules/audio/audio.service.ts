import { Injectable } from '@nestjs/common';
import { AudioProcessingService } from '../../shared/audio/audio-processing.service';
import { StorageService } from '../../shared/storage/storage.service';

@Injectable()
export class AudioService {
	constructor(
		private readonly storage: StorageService,
		private readonly audioProcessing: AudioProcessingService,
	) {}

	storeAudio(key: string, body: Uint8Array, contentType: string) {
		return this.storage.putObject(key, body, contentType);
	}

	inspectAudio(inputPath: string) {
		return this.audioProcessing.getMetadata(inputPath);
	}
}
