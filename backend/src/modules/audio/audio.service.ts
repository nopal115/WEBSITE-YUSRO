import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AudioStatus, AudioType, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { tmpdir } from 'os';
import { AudioProcessingService } from '../../shared/audio/audio-processing.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';

@Injectable()
export class AudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audioProcessing: AudioProcessingService,
  ) {}

  storeAudio(key: string, body: Uint8Array, contentType: string) {
    return this.storage.putObject(key, body, contentType);
  }

  inspectAudio(inputPath: string) {
    return this.audioProcessing.getMetadata(inputPath);
  }

  async listAudio(type?: AudioType) {
    const list = await this.prisma.audioAsset.findMany({
      where: type ? { type } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        type: true,
        status: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        durationSeconds: true,
        durationMs: true,
        createdAt: true,
      },
    });

    return list.map((item) => ({
      id: item.id,
      kind: item.type,
      originalName: item.originalName,
      durationMs: item.durationMs ?? Math.round((item.durationSeconds ?? 0) * 1000),
      durationSeconds: item.durationSeconds,
      status: item.status,
      sizeBytes: item.sizeBytes,
      createdAt: item.createdAt,
    }));
  }

  async getPlayableUrl(audioId: string) {
    const audio = await this.prisma.audioAsset.findFirst({
      where: {
        id: audioId,
        status: AudioStatus.ACTIVE,
        type: { in: [AudioType.LEARNING, AudioType.REFERENCE] },
      },
      select: { id: true, originalName: true, mimeType: true, durationSeconds: true, durationMs: true, objectKey: true },
    });
    if (!audio) throw new NotFoundException('Audio tidak ditemukan atau telah diarsipkan.');

    const url = await this.storage.getSignedGetUrl(audio.objectKey);
    return {
      url,
      expiresInSeconds: 900,
      audio: {
        id: audio.id,
        originalName: audio.originalName,
        mimeType: audio.mimeType,
        durationSeconds: audio.durationSeconds,
        durationMs: audio.durationMs ?? Math.round((audio.durationSeconds ?? 0) * 1000),
        url,
      },
    };
  }

  async archiveAudio(audioId: string) {
    const audio = await this.prisma.audioAsset.findUnique({ where: { id: audioId } });
    if (!audio) throw new NotFoundException('Audio tidak ditemukan.');

    return this.prisma.audioAsset.update({
      where: { id: audioId },
      data: { status: AudioStatus.ARCHIVED },
    });
  }

  async replaceAudio(audioId: string, file: Express.Multer.File) {
    const oldAudio = await this.prisma.audioAsset.findUnique({ where: { id: audioId } });
    if (!oldAudio) throw new NotFoundException('Audio lama tidak ditemukan.');

    const newAudio = await this.uploadAudio(file, oldAudio.type);

    await this.prisma.$transaction([
      this.prisma.audioAsset.update({
        where: { id: audioId },
        data: { status: AudioStatus.ARCHIVED },
      }),
      this.prisma.audioAsset.update({
        where: { id: newAudio.id },
        data: {
          version: oldAudio.version + 1,
          archivedFromId: oldAudio.id,
        },
      }),
    ]);

    return this.prisma.audioAsset.findUnique({ where: { id: newAudio.id } });
  }

  async uploadAudio(file: Express.Multer.File | undefined, type: AudioType) {
    if (!file?.buffer?.length) throw new BadRequestException('Berkas audio wajib diunggah.');
    if (file.buffer.length > 25 * 1024 * 1024) throw new BadRequestException('Ukuran audio maksimal 25 MB.');
    if (type === AudioType.RECORDING) {
      throw new BadRequestException('Rekaman santri hanya dapat diunggah melalui endpoint imitasi.');
    }
    if (!file.mimetype?.startsWith('audio/') && !file.mimetype?.includes('video/mp4') && !file.mimetype?.includes('application/octet-stream')) {
      throw new BadRequestException('Berkas harus bertipe konten audio.');
    }

    const temporaryDirectory = await fs.mkdtemp(join(tmpdir(), 'yusro-library-audio-'));
    const temporaryPath = join(temporaryDirectory, 'upload');
    let durationSeconds = 0;
    try {
      await fs.writeFile(temporaryPath, file.buffer);
      const metadata = await this.inspectAudio(temporaryPath);
      const audioStream = metadata.streams.find((stream) => stream.codec_type === 'audio');
      durationSeconds = metadata.format.duration ?? 0;
      if (!audioStream || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new BadRequestException('Berkas audio tidak valid atau tidak memuat aliran suara.');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Berkas audio tidak dapat diurai.');
    } finally {
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }

    const safeName = basename(file.originalname || 'audio').replace(/[\r\n\0]/g, '').slice(0, 255) || 'audio';
    const objectKey = `library/${type.toLowerCase()}/${randomUUID()}`;
    const checksumSha256 = createHash('sha256').update(file.buffer).digest('hex');
    await this.storeAudio(objectKey, file.buffer, file.mimetype || 'audio/mpeg');

    try {
      return await this.prisma.audioAsset.create({
        data: {
          type,
          status: AudioStatus.ACTIVE,
          originalName: safeName,
          objectKey,
          mimeType: file.mimetype || 'audio/mpeg',
          sizeBytes: file.buffer.length,
          durationSeconds,
          durationMs: Math.round(durationSeconds * 1000),
          checksumSha256,
        },
        select: {
          id: true,
          type: true,
          status: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          durationSeconds: true,
          durationMs: true,
          createdAt: true,
        },
      });
    } catch (error) {
      try {
        await this.storage.deleteObject(objectKey);
      } catch (cleanupError) {
        try {
          await this.prisma.storageOrphan.upsert({
            where: { objectKey },
            update: { lastErrorDetail: this.errorDetail(cleanupError) },
            create: { objectKey, cleanupReason: 'AUDIO_UPLOAD_TRANSACTION_FAILED', lastErrorDetail: this.errorDetail(error) },
          });
        } catch {
          // Orphan cleanup handler
        }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Audio sudah ada.');
      }
      throw error;
    }
  }

  private errorDetail(error: unknown): string {
    return (error instanceof Error ? error.message : 'Unknown storage cleanup error').slice(0, 1000);
  }
}
