import { Controller, Get, NotFoundException, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { Public } from '../../shared/decorators/public.decorator';

@Controller('audio')
export class LocalAudioController {
  @Public()
  @Get(['local/:key', 'local/*'])
  streamLocal(@Req() req: Request, @Res() res: Response, @Param('key') paramKey?: string): void {
    const rawKey = paramKey || (req.params as any)[0] || (req.params as any).key || '';
    let key = rawKey;
    try {
      key = decodeURIComponent(rawKey);
    } catch {
      key = rawKey;
    }
    const safeKey = path.normalize(key).replace(/^(\.\.[\/\\])+/, '');
    const uploadsDir = path.resolve(process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), 'uploads'));
    const filePath = path.join(uploadsDir, safeKey);

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new NotFoundException('Audio file not found');
    }
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).send('Audio file not found');
      }
    });
  }
}

