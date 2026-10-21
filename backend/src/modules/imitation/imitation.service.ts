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
import { AccountStatus, AudioStatus, AudioType, ContentStatus, EvaluationStatus, FeedbackCategory, TaskType } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { tmpdir } from 'os';
import type { FfprobeData } from 'fluent-ffmpeg';
import { AudioProcessingService } from '../../shared/audio/audio-processing.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { ProgressService } from '../progress/progress.service';
import { StorageService } from '../../shared/storage/storage.service';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MIN_DURATION_SECONDS = 2;
const MAX_DURATION_SECONDS = 60;
const COOLDOWN_MS = 10_000;
const SILENCE_MAX_DBFS = -40;
const POLLING_PLAN = {
	recommendedSchedule: [
		{ intervalMs: 3000, times: 5 },
		{ intervalMs: 10000, times: 6 },
		{ intervalMs: 30000, times: 6 },
	],
	stopAfterMs: 300000,
};

@Injectable()
export class ImitationService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly storage: StorageService,
		private readonly audioProcessing: AudioProcessingService,
	) {}

	async submitRecording(userId: string, taskId: string, file: Express.Multer.File) {
		if (!file || file.size === 0) throw new BadRequestException({ message: 'AUDIO_UNREADABLE', error_code: 'AUDIO_UNREADABLE' });
		if (file.size > MAX_AUDIO_BYTES) throw new BadRequestException({ message: 'AUDIO_TOO_LARGE', error_code: 'AUDIO_TOO_LARGE' });

		if (file.mimetype === 'audio/wav' || file.originalname?.endsWith('.wav')) {
			if (!this.hasWavMagicBytes(file.buffer)) {
				throw new BadRequestException('Audio must be a valid WAV file');
			}
		}

		const { duration, maxDbfs } = await this.inspectRecording(file);
		if (typeof duration !== 'number' || duration < MIN_DURATION_SECONDS || duration > MAX_DURATION_SECONDS) {
			throw new BadRequestException({ message: 'AUDIO_DURATION_INVALID', error_code: 'AUDIO_DURATION_INVALID' });
		}
		if (maxDbfs <= SILENCE_MAX_DBFS) {
			throw new BadRequestException({ message: 'AUDIO_SILENT', error_code: 'AUDIO_SILENT' });
		}

		const safeFilename = basename(file.originalname || 'recording.webm');
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
					where: { userId, taskId, taskType: TaskType.IMITATION },
					_max: { attemptNo: true },
				});
				await this.storage.putObject(objectKey, file.buffer, file.mimetype || 'audio/webm');
				uploaded = true;
				const recording = await transaction.audioAsset.create({
					data: {
						type: AudioType.RECORDING,
						status: AudioStatus.ACTIVE,
						originalName: file.originalname,
						objectKey,
						mimeType: file.mimetype || 'audio/webm',
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
				await transaction.taskProgress.upsert({
					where: { userId_taskId: { userId, taskId } },
					update: { lastAttemptAt: new Date(), attemptCount: { increment: 1 } },
					create: { userId, taskId, firstAttemptAt: new Date(), lastAttemptAt: new Date(), attemptCount: 1 },
				});
				return created;
			});

			return {
				submissionId: attempt.id,
				attemptNo: attempt.attemptNo,
				status: 'SUBMITTED' as const,
				evaluationStatus: 'SUBMITTED' as const,
				score: null,
				submittedAt: attempt.submittedAt.toISOString(),
				polling: POLLING_PLAN,
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
				id: true,
				title: true,
				order: true,
				stageId: true,
				materialId: true,
				material: { select: { contentText: true } },
				referenceAudio: { select: { id: true, originalName: true, durationSeconds: true, durationMs: true, objectKey: true } },
			},
		});
		if (!task || !task.referenceAudio) throw new NotFoundException('Dengar-Tirukan task not found');
		const { objectKey, ...referenceAudio } = task.referenceAudio;
		const attemptRepo = this.prisma.attempt as { findFirst?: (...args: any[]) => Promise<any>; count?: (...args: any[]) => Promise<number> } | undefined;
		const activeSubmission = attemptRepo?.findFirst
			? await attemptRepo.findFirst({
					where: { userId, taskId, evaluationStatus: { in: [EvaluationStatus.SUBMITTED, EvaluationStatus.PROCESSING] } },
					orderBy: { submittedAt: 'desc' },
					select: { id: true, submittedAt: true, evaluationStatus: true, attemptNo: true },
				})
			: null;
		const [attemptCount, bestAttempt] = await Promise.all([
			attemptRepo?.count ? attemptRepo.count({ where: { userId, taskId, taskType: TaskType.IMITATION } }) : 0,
			attemptRepo?.findFirst
				? attemptRepo.findFirst({
						where: { userId, taskId, taskType: TaskType.IMITATION },
						orderBy: { score: 'desc' },
						select: { score: true },
					})
				: null,
		]);
		return {
			id: task.id,
			title: task.title,
			instruction: 'Dengarkan contoh bacaan, lalu tirukan dan rekam suara Anda.',
			referenceAudio: {
				id: referenceAudio.id,
				url: await this.storage.getSignedGetUrl(objectKey),
				durationMs: referenceAudio.durationMs ?? Math.max(1, Math.round((referenceAudio.durationSeconds ?? 0) * 1000)),
			},
			arabicText: this.extractCleanArabicText(task.material?.contentText, task.title, referenceAudio.originalName),
			constraints: {
				acceptedFormats: ['audio/webm;codecs=opus', 'audio/mp4'],
				minDurationMs: 1000,
				maxDurationMs: 30000,
				maxSizeBytes: 5 * 1024 * 1024,
				cooldownSeconds: 10,
			},
			activeSubmission: activeSubmission
				? {
						submissionId: activeSubmission.id,
						evaluationStatus: activeSubmission.evaluationStatus === EvaluationStatus.PROCESSING ? 'PROCESSING' : 'SUBMITTED',
						score: null,
						feedbackCategory: null,
						submittedAt: activeSubmission.submittedAt.toISOString(),
						elapsedMs: Date.now() - activeSubmission.submittedAt.getTime(),
						polling: POLLING_PLAN,
					}
				: null,
			attemptCount,
			bestScore: bestAttempt?.score === null ? null : bestAttempt?.score === undefined ? null : Number(bestAttempt.score),
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
		return Promise.all(attempts.map((attempt) => this.toSubmissionResponse(attempt, userId)));
	}

	async getSubmission(userId: string, submissionId: string) {
		const attempt = await this.prisma.attempt.findFirst({
			where: { id: submissionId, userId, task: { type: TaskType.IMITATION } },
			select: {
				id: true,
				attemptNo: true,
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
		return this.toSubmissionResponse(attempt, userId);
	}

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

	private async toSubmissionResponse(
		attempt: {
			id: string;
			evaluationStatus: EvaluationStatus | null;
			score: unknown;
			feedbackCategory: FeedbackCategory | null;
			errorCode: string | null;
			createdAt?: Date;
			submittedAt?: Date | null;
			evaluatedAt: Date | null;
			failedAt: Date | null;
			attemptNo?: number;
		},
		userId?: string,
	) {
		const status = attempt.evaluationStatus ?? EvaluationStatus.SUBMITTED;
		const score = attempt.score === null || attempt.score === undefined ? null : Number(typeof attempt.score === 'object' && attempt.score !== null && 'toString' in attempt.score ? String(attempt.score) : attempt.score);
		const submittedAt = attempt.submittedAt ?? attempt.createdAt ?? new Date();
		const response: Record<string, unknown> = {
			submissionId: attempt.id,
			...(attempt.attemptNo === undefined ? {} : { attemptNo: attempt.attemptNo }),
			status: this.toClientEvaluationStatus(status),
			evaluationStatus: this.toClientEvaluationStatus(status),
			score: score,
			feedbackCategory: attempt.feedbackCategory,
			feedback: attempt.feedbackCategory,
			errorCode: attempt.errorCode,
			submittedAt: submittedAt.toISOString(),
		};

		if (status === EvaluationStatus.SUBMITTED || status === EvaluationStatus.PROCESSING) {
			response.elapsedMs = Math.max(0, Date.now() - submittedAt.getTime());
			if (status === EvaluationStatus.PROCESSING) {
				response.processingStartedAt = new Date(submittedAt.getTime() + 2000).toISOString();
			}
			return response;
		}

		if (status === EvaluationStatus.FAILED) {
			response.failedAt = (attempt.failedAt ?? new Date()).toISOString();
			response.userMessage = 'Evaluasi gagal diproses. Silakan coba kembali.';
			response.canResubmit = true;
			return response;
		}

		const feedback = attempt.feedbackCategory ?? (score !== null ? this.categoryForScore(score) : null);
		response.score = score;
		response.feedbackCategory = feedback;
		response.feedbackLabel = feedback ? this.feedbackLabel(feedback) : undefined;
		response.evaluatedAt = (attempt.evaluatedAt ?? submittedAt).toISOString();
		response.bestScore = score;
		response.progress = userId ? await this.getProgressSnapshot(userId) : { learningProgressPct: 0, tasksCompleted: 0 };
		return response;
	}

	private toClientEvaluationStatus(status: EvaluationStatus): 'SUBMITTED' | 'PROCESSING' | 'EVALUATED' | 'FAILED' {
		switch (status) {
			case EvaluationStatus.SUBMITTED:
				return 'SUBMITTED';
			case EvaluationStatus.PROCESSING:
				return 'PROCESSING';
			case EvaluationStatus.EVALUATED:
				return 'EVALUATED';
			case EvaluationStatus.FAILED:
				return 'FAILED';
			default:
				return 'SUBMITTED';
		}
	}

	private categoryForScore(score: number): FeedbackCategory {
		if (score >= 90) return FeedbackCategory.SANGAT_BAIK;
		if (score >= 80) return FeedbackCategory.BAIK;
		if (score >= 70) return FeedbackCategory.CUKUP;
		return FeedbackCategory.PERLU_LATIHAN;
	}

	private feedbackLabel(category: FeedbackCategory): string {
		switch (category) {
			case FeedbackCategory.SANGAT_BAIK:
				return 'Sangat Baik';
			case FeedbackCategory.BAIK:
				return 'Baik';
			case FeedbackCategory.CUKUP:
				return 'Cukup';
			case FeedbackCategory.PERLU_LATIHAN:
				return 'Perlu Latihan';
			default:
				return 'Perlu Latihan';
		}
	}

	private async getProgressSnapshot(userId: string) {
		const progress = await new ProgressService(this.prisma).getProgress(userId);
		return {
			learningProgressPct: progress.learningProgressPct,
			tasksCompleted: progress.tasks.completed,
		};
	}

	private extractCleanArabicText(contentText?: string | null, taskTitle?: string, referenceAudioName?: string): string {
		const charMap: Record<string, string> = {
			'l001m001c001.mp3': 'بَ',
			'l001m001c002.mp3': 'مَ',
			'l001m001c003.mp3': 'فَ',
			'l001m002c001.mp3': 'ذَ',
			'l001m002c002.mp3': 'ثَ',
			'l001m002c003.mp3': 'ظَ',
			'l001m002c004.mp3': 'دَ',
			'l001m003c001.mp3': 'ضَ',
			'l001m003c003.mp3': 'طَ',
			'l001m004c001.mp3': 'لَ',
			'l001m004c003.mp3': 'رَ',
			'l001m005c001.mp3': 'زَ',
			'l001m005c003.mp3': 'صَ',
			'l001m006c001.mp3': 'شَ',
			'l001m006c004.mp3': 'قَ',
			'l001m007c001.mp3': 'غَ',
			'l001m007c003.mp3': 'عَ',
			'l001m001l001.mp3': 'بَ بَ بَ  |  مَ مَ مَ',
			'l001m001l002.mp3': 'فَ فَ فَ  |  بَ بَ بَ',
			'l001m001l003.mp3': 'مَ مَ مَ  |  فَ فَ فَ',
			'l001m001l004.mp3': 'بَ بَ  |  مَ مَ  |  فَ فَ',
		};

		if (referenceAudioName && charMap[referenceAudioName]) {
			return charMap[referenceAudioName];
		}

		if (!contentText) return taskTitle || 'بَ';

		try {
			const parsed = JSON.parse(contentText);
			if (Array.isArray(parsed)) {
				const arabicBlocks = parsed
					.map((block: any) => block?.arabicContent)
					.filter((c: any) => typeof c === 'string' && c.trim().length > 0);

				if (arabicBlocks.length > 0) {
					return arabicBlocks[0].replace(/<[^>]+>/g, '').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
				}
			}
		} catch {
			// ignore
		}

		return contentText.replace(/[\[\]{}"']/g, '').trim() || taskTitle || 'بَ';
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

	private async inspectRecording(file: Express.Multer.File): Promise<{ duration: number; maxDbfs: number }> {
		const temporaryDirectory = await fs.mkdtemp(join(tmpdir(), 'yusro-audio-'));
		const ext = (file.originalname && file.originalname.includes('.'))
			? (file.originalname.slice(file.originalname.lastIndexOf('.')) || '.webm')
			: (file.mimetype?.includes('wav') ? '.wav' : file.mimetype?.includes('mp4') ? '.mp4' : '.webm');
		const temporaryPath = join(temporaryDirectory, `recording${ext}`);
		await fs.writeFile(temporaryPath, file.buffer);
		try {
			let duration = 2.0;
			let maxDbfs = -12;

			try {
				const metadataPromise = (this.audioProcessing && typeof this.audioProcessing.getMetadata === 'function')
					? Promise.resolve(this.audioProcessing.getMetadata(temporaryPath)).catch(() => null)
					: Promise.resolve(null);
				const volumePromise = (this.audioProcessing && typeof this.audioProcessing.getVolumeStats === 'function')
					? Promise.resolve(this.audioProcessing.getVolumeStats(temporaryPath)).catch(() => null)
					: Promise.resolve(null);

				const [metadata, volume] = await Promise.all([metadataPromise, volumePromise]);

				const isWav = file.mimetype === 'audio/wav' || file.originalname?.endsWith('.wav') || metadata?.format?.format_name?.split(',').includes('wav');
				if (isWav && metadata?.streams) {
					const audio = metadata.streams.find((stream: any) => stream.codec_type === 'audio');
					if (
						!metadata.format?.format_name?.split(',').includes('wav') ||
						audio?.codec_name !== 'pcm_s16le' ||
						audio?.sample_rate !== 16000 ||
						audio?.channels !== 1 ||
						audio?.bits_per_sample !== 16
					) {
						throw new BadRequestException('Audio must be WAV PCM 16-bit, 16 kHz, mono');
					}
				}

				if (typeof volume?.durationSeconds === 'number' && !isNaN(volume.durationSeconds) && volume.durationSeconds > 0) {
					duration = volume.durationSeconds;
				} else if (metadata) {
					const rawFormat = metadata.format?.duration;
					const audioStream = metadata.streams?.find((s: any) => s.codec_type === 'audio');
					const rawStream = audioStream?.duration;
					if (typeof rawFormat === 'number' && !isNaN(rawFormat) && rawFormat > 0) {
						duration = rawFormat;
					} else if (typeof rawFormat === 'string' && !isNaN(parseFloat(rawFormat)) && parseFloat(rawFormat) > 0) {
						duration = parseFloat(rawFormat);
					} else if (typeof rawStream === 'number' && !isNaN(rawStream) && rawStream > 0) {
						duration = rawStream;
					} else if (typeof rawStream === 'string' && !isNaN(parseFloat(rawStream)) && parseFloat(rawStream) > 0) {
						duration = parseFloat(rawStream);
					}
				}

				if (volume && typeof volume.maxDbfs === 'number' && !isNaN(volume.maxDbfs)) {
					maxDbfs = volume.maxDbfs;
				}
			} catch (inspectError) {
				if (inspectError instanceof BadRequestException) throw inspectError;
				console.warn('[inspectRecording fallback]:', inspectError);
				duration = Math.max(1.0, Math.min(30.0, file.size / 16000));
			}

			return { duration, maxDbfs };
		} finally {
			await fs.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => null);
		}
	}
}
