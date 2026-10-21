import { Injectable } from '@nestjs/common';
import { devNull } from 'os';
import type { FfprobeData } from 'fluent-ffmpeg';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg = require('fluent-ffmpeg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegStatic = require('ffmpeg-static');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobeStatic = require('ffprobe-static');

export interface VolumeStats {
  meanDbfs: number;
  maxDbfs: number;
  durationSeconds?: number;
}

@Injectable()
export class AudioProcessingService {
  constructor() {
    const resolvedFfmpeg =
      process.env.FFMPEG_PATH ||
      (typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic?.default || ffmpegStatic) ||
      'ffmpeg';
    ffmpeg.setFfmpegPath(resolvedFfmpeg);
    const resolvedFfprobe = process.env.FFPROBE_PATH || ffprobeStatic?.path || ffprobeStatic?.default?.path;
    ffmpeg.setFfprobePath(resolvedFfprobe);
  }

  getMetadata(inputPath: string): Promise<FfprobeData> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (error: any, metadata: FfprobeData) => {
        if (error) reject(error);
        else resolve(metadata);
      });
    });
  }

  getVolumeStats(inputPath: string): Promise<VolumeStats> {
    return new Promise((resolve, reject) => {
      let stderr = '';
      const nullDevice = process.platform === 'win32' ? 'NUL' : devNull;
      ffmpeg(inputPath)
        .audioFilters('volumedetect')
        .outputOptions(['-f', 'null'])
        .output(nullDevice)
        .on('stderr', (line: string) => { stderr += `${line}\n`; })
        .on('error', reject)
        .on('end', () => {
          const mean = /mean_volume:\s*(-?[\d.]+)\s*dB/.exec(stderr);
          const max = /max_volume:\s*(-?(?:[\d.]+|inf))\s*dB/.exec(stderr);
          if (!mean || !max || max[1] === '-inf') {
            reject(new Error('Could not determine audio volume'));
            return;
          }
          let durationSeconds: number | undefined;
          const matches = [...stderr.matchAll(/time=(\d+):(\d+):([\d.]+)/g)];
          if (matches.length > 0) {
            const last = matches[matches.length - 1];
            durationSeconds = parseInt(last[1], 10) * 3600 + parseInt(last[2], 10) * 60 + parseFloat(last[3]);
          }
          resolve({ meanDbfs: Number(mean[1]), maxDbfs: Number(max[1]), durationSeconds });
        })
        .run();
    });
  }
}
