import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

	listAudio(type?: AudioType) {
		return this.prisma.audioAsset.findMany({
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
				createdAt: true,
			},
		});
	}

	async getPlayableUrl(audioId: string) {
		const audio = await this.prisma.audioAsset.findFirst({
			where: {
				id: audioId,
				status: AudioStatus.ACTIVE,
				type: { in: [AudioType.LEARNING, AudioType.REFERENCE] },
			},
			select: { id: true, originalName: true, mimeType: true, durationSeconds: true, objectKey: true },
		});
		if (!audio) throw new NotFoundException('Audio not found');
		return {
			audio: {
				id: audio.id,
				originalName: audio.originalName,
				mimeType: audio.mimeType,
				durationSeconds: audio.durationSeconds,
				url: await this.storage.getSignedGetUrl(audio.objectKey),
			},
		};
	}

	async uploadAudio(file: Express.Multer.File | undefined, type: AudioType) {
		if (!file?.buffer?.length) throw new BadRequestException('Audio file is required');
		if (file.buffer.length > 25 * 1024 * 1024) throw new BadRequestException('Audio file must not exceed 25 MB');
		if (type === AudioType.RECORDING) throw new BadRequestException('Recording audio must be submitted through the imitation endpoint');
		if (!file.mimetype?.startsWith('audio/')) throw new BadRequestException('File must have an audio content type');

		const temporaryDirectory = await fs.mkdtemp(join(tmpdir(), 'yusro-library-audio-'));
		const temporaryPath = join(temporaryDirectory, 'upload');
		let durationSeconds: number;
		try {
			await fs.writeFile(temporaryPath, file.buffer);
			const metadata = await this.inspectAudio(temporaryPath);
			const audioStream = metadata.streams.find((stream) => stream.codec_type === 'audio');
			durationSeconds = metadata.format.duration ?? 0;
			if (!audioStream || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
				throw new BadRequestException('Audio file is invalid or has no playable audio stream');
			}
		} catch (error) {
			if (error instanceof BadRequestException) throw error;
			throw new BadRequestException('Audio file cannot be read');
		} finally {
			await fs.rm(temporaryDirectory, { recursive: true, force: true });
		}

		const safeName = basename(file.originalname || 'audio').replace(/[\r\n\0]/g, '').slice(0, 255) || 'audio';
		const objectKey = `library/${type.toLowerCase()}/${randomUUID()}`;
		const checksumSha256 = createHash('sha256').update(file.buffer).digest('hex');
		await this.storeAudio(objectKey, file.buffer, file.mimetype);
		try {
			return await this.prisma.audioAsset.create({
				data: {
					type,
					status: AudioStatus.ACTIVE,
					originalName: safeName,
					objectKey,
					mimeType: file.mimetype,
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
					// An object-storage lifecycle policy can remove this orphan if persistence also fails.
				}
			}
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				throw new BadRequestException('Audio already exists');
			}
			throw error;
		}
	}
	private errorDetail(error: unknown): string {
		return (error instanceof Error ? error.message : 'Unknown storage cleanup error').slice(0, 1_000);
	}
}
