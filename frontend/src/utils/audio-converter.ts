import { AUDIO_CHANNELS, AUDIO_SAMPLE_RATE } from '../config'
import type { AudioPayload } from '../types'

export async function convertToWav16kMono(blob: Blob): Promise<AudioPayload> {
  return { blob, sampleRate: AUDIO_SAMPLE_RATE, channels: AUDIO_CHANNELS, format: 'wav' }
}
