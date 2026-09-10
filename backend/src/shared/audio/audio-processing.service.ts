import { Injectable } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import * as ffprobePath from 'ffprobe-static';

@Injectable()
export class AudioProcessingService {
  constructor() {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg');
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || ffprobePath.path);
  }

  getMetadata(inputPath: string): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (error, metadata) => {
        if (error) reject(error);
        else resolve(metadata);
      });
    });
  }
}
