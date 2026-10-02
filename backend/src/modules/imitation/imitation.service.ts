import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AccountStatus, AudioStatus, AudioType, ContentStatus, EvaluationStatus, TaskType } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { tmpdir } from 'os';
import type { FfprobeData } from 'fluent-ffmpeg';
import { AudioProcessingService } from '../../shared/audio/audio-processing.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MIN_DURATION_SECONDS = 2;
const MAX_DURATION_SECONDS = 60;
const COOLDOWN_MS = 10_000;
const SILENCE_MAX_DBFS = -40;

@Injectable()
export class ImitationService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly storage: StorageService,
		private readonly audioProcessing: AudioProcessingService,
	) {}

	async submitRecording(userId: string, taskId: string, file: Express.Multer.File) {
		if (!file) throw new BadRequestException('Audio file is required');
		if (file.size > MAX_AUDIO_BYTES) throw new BadRequestException('Audio file must not exceed 10 MB');
		if (!this.hasWavMagicBytes(file.buffer)) {
			throw new BadRequestException('Audio must be a WAV file');
		}

		const { metadata, maxDbfs } = await this.inspectRecording(file);
		const duration = metadata.format.duration;
		if (typeof duration !== 'number' || duration < MIN_DURATION_SECONDS || duration > MAX_DURATION_SECONDS) {
			throw new BadRequestException('Audio duration must be between 2 and 60 seconds');
		}
		if (maxDbfs <= SILENCE_MAX_DBFS) throw new BadRequestException('Audio recording is silent');

		const safeFilename = basename(file.originalname || 'recording.wav');
		const objectKey = `recordings/${userId}/${taskId}/${randomUUID()}-${safeFilename}`;
		const checksumSha256 = createHash('sha256').update(file.buffer).digest('hex');
		let uploaded = false;

		try {
			const attempt = await this.prisma.$transaction(async (transaction) => {
				await transaction.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${taskId}))) AS advisory_lock`;
				const user = await transaction.user.findUnique({ where: { id: userId }, select: { status: true } });
				if (!user) throw new NotFoundException('User not found');
				if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Account is inactive');
				const task = await transaction.task.findFirst({
					where: { id: taskId, type: TaskType.IMITATION, status: ContentStatus.ACTIVE },
					select: { id: true, referenceAudioId: true },
				});
				if (!task) throw new NotFoundException('Dengar-Tirukan task not found');
				if (!task.referenceAudioId) throw new BadRequestException('Task has no reference audio');
				const activeSubmission = await transaction.attempt.findFirst({
					where: { userId, taskId, evaluationStatus: { in: [EvaluationStatus.SUBMITTED, EvaluationStatus.PROCESSING] } },
					select: { id: true },
				});
				if (activeSubmission) {
					throw new ConflictException({
						message: 'An evaluation is already active for this task',
						error_code: 'IMITATION_ACTIVE_EXISTS',
					});
				}
				const latestSubmission = await transaction.attempt.findFirst({
					where: { userId, taskId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true },
				});
				if (latestSubmission && Date.now() - latestSubmission.createdAt.getTime() < COOLDOWN_MS) {
					throw new HttpException({
						message: 'Please wait 10 seconds before submitting another recording',
						error_code: 'IMITATION_COOLDOWN',
					}, HttpStatus.TOO_MANY_REQUESTS);
				}
				const previous = await transaction.attempt.aggregate({
					where: { userId, taskId },
					_max: { attemptNo: true },
				});
				await this.storage.putObject(objectKey, file.buffer, 'audio/wav');
				uploaded = true;
				const recording = await transaction.audioAsset.create({
					data: {
						type: AudioType.RECORDING,
						status: AudioStatus.ACTIVE,
						originalName: file.originalname,
						objectKey,
						mimeType: 'audio/wav',
						sizeBytes: file.size,
						durationSeconds: duration,
						durationMs: Math.round(duration * 1000),
						checksumSha256,
					},
				});
				const created = await transaction.attempt.create({
					data: {
						userId,
						taskId,
						taskType: TaskType.IMITATION,
						attemptNo: (previous._max.attemptNo ?? 0) + 1,
						recordingAudioId: recording.id,
						referenceAudioId: task.referenceAudioId,
						evaluationStatus: EvaluationStatus.SUBMITTED,
						submittedAt: new Date(),
					},
				});
				await transaction.evaluationJob.create({ data: { attemptId: created.id } });
				await transaction.taskProgress.upsert({
					where: { userId_taskId: { userId, taskId } },
					update: { completedAt: new Date(), lastAttemptAt: new Date(), attemptCount: { increment: 1 } },
					create: { userId, taskId, completedAt: new Date(), firstAttemptAt: new Date(), lastAttemptAt: new Date(), attemptCount: 1 },
				});
				return created;
			});

			return {
				submissionId: attempt.id,
				status: attempt.evaluationStatus,
				submittedAt: attempt.createdAt,
			};
		} catch (error) {
			if (uploaded) await this.cleanupOrphan(objectKey, error);
			throw error;
		}
	}

	async getTask(userId: string, taskId: string) {
		await this.assertActiveUser(userId);
		const task = await this.prisma.task.findFirst({
			where: { id: taskId, type: TaskType.IMITATION, status: ContentStatus.ACTIVE },
			select: {
				id: true, title: true, order: true, stageId: true, materialId: true,
				referenceAudio: { select: { id: true, originalName: true, durationSeconds: true, objectKey: true } },
			},
		});
		if (!task || !task.referenceAudio) throw new NotFoundException('Dengar-Tirukan task not found');
		const { objectKey, ...referenceAudio } = task.referenceAudio;
		return {
			...task,
			referenceAudio: { ...referenceAudio, url: await this.storage.getSignedGetUrl(objectKey) },
		};
	}

	async listSubmissions(userId: string, taskId: string) {
		await this.assertActiveUser(userId);
		const task = await this.prisma.task.findFirst({
			where: { id: taskId, type: TaskType.IMITATION }, select: { id: true },
		});
		if (!task) throw new NotFoundException('Dengar-Tirukan task not found');
		const attempts = await this.prisma.attempt.findMany({
			where: { userId, taskId, taskType: TaskType.IMITATION }, orderBy: { submittedAt: 'desc' },
			select: { id: true, attemptNo: true, evaluationStatus: true, score: true, feedbackCategory: true, errorCode: true, submittedAt: true, evaluatedAt: true, failedAt: true },
		});
		return attempts.map((attempt) => this.toSubmissionResponse(attempt));
	}

	async getSubmission(userId: string, submissionId: string) {
		const attempt = await this.prisma.attempt.findFirst({
			where: { id: submissionId, userId, task: { type: TaskType.IMITATION } },
			select: {
				id: true,
				evaluationStatus: true,
				score: true,
				feedbackCategory: true,
				errorCode: true,
				submittedAt: true,
				evaluatedAt: true,
				failedAt: true,
			},
		});
		if (!attempt) throw new NotFoundException('Submission not found');
		return this.toSubmissionResponse(attempt);
	}

	// A failed immediate delete is recorded during submit. Retrying here keeps
	// storage cleanup independent from the request lifecycle and safely marks
	// each row only after object deletion succeeds.
	@Interval(5 * 60_000)
	async cleanupRecordedOrphans(): Promise<void> {
		const orphans = await this.prisma.storageOrphan.findMany({
			where: { cleanedAt: null },
			orderBy: { createdAt: 'asc' },
			take: 100,
			select: { id: true, objectKey: true },
		});
		for (const orphan of orphans) {
			try {
				await this.storage.deleteObject(orphan.objectKey);
				await this.prisma.storageOrphan.updateMany({
					where: { id: orphan.id, cleanedAt: null },
					data: { cleanedAt: new Date(), lastErrorDetail: null },
				});
			} catch (error) {
				await this.prisma.storageOrphan.updateMany({
					where: { id: orphan.id, cleanedAt: null },
					data: { lastErrorDetail: this.errorDetail(error) },
				});
			}
		}
	}

	private toSubmissionResponse(attempt: { id: string; evaluationStatus: EvaluationStatus | null; score: unknown; feedbackCategory: unknown; errorCode: string | null; createdAt?: Date; submittedAt?: Date; evaluatedAt: Date | null; failedAt: Date | null; attemptNo?: number }) {
		return {
			submissionId: attempt.id,
			...(attempt.attemptNo === undefined ? {} : { attemptNo: attempt.attemptNo }),
			status: attempt.evaluationStatus,
			score: attempt.score,
			feedback: attempt.feedbackCategory,
			errorCode: attempt.errorCode,
			submittedAt: attempt.submittedAt ?? attempt.createdAt,
			evaluatedAt: attempt.evaluatedAt,
			failedAt: attempt.failedAt,
		};
	}

	private hasWavMagicBytes(buffer: Buffer): boolean {
		return buffer.length >= 12
			&& buffer.subarray(0, 4).toString('ascii') === 'RIFF'
			&& buffer.subarray(8, 12).toString('ascii') === 'WAVE';
	}

	private async cleanupOrphan(objectKey: string, cause: unknown): Promise<void> {
		try {
			await this.storage.deleteObject(objectKey);
		} catch (cleanupError) {
			try {
				await this.prisma.storageOrphan.upsert({
					where: { objectKey },
					update: { lastErrorDetail: this.errorDetail(cleanupError) },
					create: { objectKey, cleanupReason: 'IMITATION_SUBMIT_TRANSACTION_FAILED', lastErrorDetail: this.errorDetail(cause) },
				});
			} catch {
				// Storage lifecycle policy remains the final safety net if the DB is unavailable too.
			}
		}
	}

	private errorDetail(error: unknown): string {
		return (error instanceof Error ? error.message : 'Unknown error').slice(0, 1_000);
	}

	private async assertActiveUser(userId: string): Promise<void> {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
		if (!user) throw new NotFoundException('User not found');
		if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Account is inactive');
	}

	private async inspectRecording(file: Express.Multer.File): Promise<{ metadata: FfprobeData; maxDbfs: number }> {
		const temporaryDirectory = await fs.mkdtemp(join(tmpdir(), 'yusro-audio-'));
		const temporaryPath = join(temporaryDirectory, 'recording.wav');
		await fs.writeFile(temporaryPath, file.buffer);
		try {
			const [metadata, volume] = await Promise.all([
				this.audioProcessing.getMetadata(temporaryPath),
				this.audioProcessing.getVolumeStats(temporaryPath),
			]);
			const audio = metadata.streams.find((stream) => stream.codec_type === 'audio');
			if (!metadata.format.format_name?.split(',').includes('wav') || audio?.codec_name !== 'pcm_s16le' || audio.sample_rate !== 16000 || audio.channels !== 1 || audio.bits_per_sample !== 16) {
				throw new BadRequestException('Audio must be WAV PCM 16-bit, 16 kHz, mono');
			}
			return { metadata, maxDbfs: volume.maxDbfs };
		} catch (error) {
			if (error instanceof BadRequestException) throw error;
			// Avoid exposing parser details from ffprobe/ffmpeg to API clients.
			throw new BadRequestException('Audio file cannot be read');
		} finally {
			await fs.rm(temporaryDirectory, { recursive: true, force: true });
		}
	}
}
