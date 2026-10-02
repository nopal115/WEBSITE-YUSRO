import { Injectable } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import * as ffprobePath from 'ffprobe-static';
import { devNull } from 'os';

export interface VolumeStats {
  meanDbfs: number;
  maxDbfs: number;
}

@Injectable()
export class AudioProcessingService {
  constructor() {
    const resolvedFfmpeg =
      process.env.FFMPEG_PATH ||
      (typeof ffmpegPath === 'string' ? ffmpegPath : (ffmpegPath as any)?.default) ||
      (typeof require !== 'undefined' ? require('ffmpeg-static') : null) ||
      'ffmpeg';
    ffmpeg.setFfmpegPath(resolvedFfmpeg);
    const resolvedFfprobe = process.env.FFPROBE_PATH || (ffprobePath as any)?.path || (ffprobePath as any)?.default?.path;
    ffmpeg.setFfprobePath(resolvedFfprobe);
  }

  getMetadata(inputPath: string): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (error, metadata) => {
        if (error) reject(error);
        else resolve(metadata);
      });
    });
  }

  getVolumeStats(inputPath: string): Promise<VolumeStats> {
    return new Promise((resolve, reject) => {
      let stderr = '';
      ffmpeg(inputPath)
        .audioFilters('volumedetect')
        .outputOptions(['-f', 'null'])
        .output(devNull)
        .on('stderr', (line: string) => { stderr += `${line}\n`; })
        .on('error', reject)
        .on('end', () => {
          const mean = /mean_volume:\s*(-?[\d.]+)\s*dB/.exec(stderr);
          const max = /max_volume:\s*(-?(?:[\d.]+|inf))\s*dB/.exec(stderr);
          if (!mean || !max || max[1] === '-inf') {
            reject(new Error('Could not determine audio volume'));
            return;
          }
          resolve({ meanDbfs: Number(mean[1]), maxDbfs: Number(max[1]) });
        })
        .run();
    });
  }
}
