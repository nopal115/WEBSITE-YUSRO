import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { AccountStatus, AudioStatus, AudioType, ContentStatus, EvaluationStatus, TaskType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { FfprobeData } from 'fluent-ffmpeg';
import { AudioProcessingService } from '../../shared/audio/audio-processing.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';
import { MlClientService } from '../ml-client/ml-client.service';

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 30;
const COOLDOWN_MS = 10_000;
const ALLOWED_AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/mpeg']);

@Injectable()
export class ImitationService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly storage: StorageService,
		private readonly audioProcessing: AudioProcessingService,
		private readonly mlClient: MlClientService,
	) {}

	async submitRecording(userId: string, taskId: string, file: Express.Multer.File) {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
		if (!user) throw new NotFoundException('User not found');
		if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Account is inactive');
		if (!file) throw new BadRequestException('Audio file is required');
		if (file.size > MAX_AUDIO_BYTES) throw new BadRequestException('Audio file must not exceed 5 MB');
		if (!ALLOWED_AUDIO_TYPES.has(file.mimetype)) {
			throw new BadRequestException('Unsupported audio format');
		}

		const task = await this.prisma.task.findFirst({
			where: { id: taskId, type: TaskType.LISTEN_REPEAT, status: ContentStatus.ACTIVE },
			select: { id: true, referenceAudioId: true },
		});
		if (!task) throw new NotFoundException('Dengar-Tirukan task not found');
		if (!task.referenceAudioId) throw new BadRequestException('Task has no reference audio');

		const activeSubmission = await this.prisma.submission.findFirst({
			where: { userId, taskId, status: { in: [EvaluationStatus.SUBMITTED, EvaluationStatus.PROCESSING] } },
			select: { id: true },
		});
		if (activeSubmission) throw new ConflictException('An evaluation is already active for this task');

		const latestSubmission = await this.prisma.submission.findFirst({
			where: { userId, taskId },
			orderBy: { submittedAt: 'desc' },
			select: { submittedAt: true },
		});
		if (latestSubmission && Date.now() - latestSubmission.submittedAt.getTime() < COOLDOWN_MS) {
			throw new ConflictException('Please wait 10 seconds before submitting another recording');
		}

		const metadata = await this.getAudioMetadata(file);
		const duration = metadata.format.duration;
		if (typeof duration !== 'number' || duration < MIN_DURATION_SECONDS || duration > MAX_DURATION_SECONDS) {
			throw new BadRequestException('Audio duration must be between 1 and 30 seconds');
		}

		const objectKey = `recordings/${userId}/${taskId}/${randomUUID()}-${file.originalname}`;
		await this.storage.putObject(objectKey, file.buffer, file.mimetype);

		try {
			const submission = await this.prisma.$transaction(async (transaction) => {
				const recording = await transaction.audioAsset.create({
					data: {
						type: AudioType.RECORDING,
						status: AudioStatus.ACTIVE,
						originalName: file.originalname,
						objectKey,
						mimeType: file.mimetype,
						sizeBytes: file.size,
						durationSeconds: duration,
					},
				});
				const created = await transaction.submission.create({
					data: {
						userId,
						taskId,
						recordingAudioId: recording.id,
						referenceAudioId: task.referenceAudioId,
						status: EvaluationStatus.SUBMITTED,
					},
				});
				await transaction.taskProgress.upsert({
					where: { userId_taskId: { userId, taskId } },
					update: { completedAt: new Date() },
					create: { userId, taskId, completedAt: new Date() },
				});
				return created;
			});

			setImmediate(() => void this.processEvaluation(submission.id, file.buffer, file.originalname, file.mimetype));
			return {
				submissionId: submission.id,
				status: submission.status,
				submittedAt: submission.submittedAt,
			};
		} catch (error) {
			throw new BadRequestException(`Could not save submission: ${error instanceof Error ? error.message : 'unknown error'}`);
		}
	}

	async getSubmission(userId: string, submissionId: string) {
		const submission = await this.prisma.submission.findFirst({
			where: { id: submissionId, userId },
			include: { evaluation: true },
		});
		if (!submission) throw new NotFoundException('Submission not found');
		return {
			submissionId: submission.id,
			status: submission.status,
			score: submission.evaluation?.score ?? null,
			feedback: submission.evaluation?.feedback ?? null,
			errorMessage: submission.errorMessage ?? submission.evaluation?.errorMessage ?? null,
		};
	}

	async retryEvaluation(userId: string, submissionId: string) {
		const submission = await this.prisma.submission.findFirst({
			where: { id: submissionId, userId, status: EvaluationStatus.FAILED },
			include: { recordingAudio: true },
		});
		if (!submission) throw new NotFoundException('Failed submission not found');
		const audio = await this.storage.getObject(submission.recordingAudio.objectKey);
		await this.prisma.submission.update({
			where: { id: submissionId },
			data: { status: EvaluationStatus.SUBMITTED, errorMessage: null, processedAt: null },
		});
		setImmediate(() => void this.processEvaluation(
			submission.id,
			Buffer.from(audio),
			submission.recordingAudio.originalName,
			submission.recordingAudio.mimeType,
		));
		return { submissionId, status: EvaluationStatus.SUBMITTED };
	}

	private async processEvaluation(
		submissionId: string,
		audio: Buffer,
		filename: string,
		contentType: string,
	): Promise<void> {
		try {
			await this.prisma.submission.update({
				where: { id: submissionId },
				data: { status: EvaluationStatus.PROCESSING, errorMessage: null },
			});
			const result = await this.mlClient.evaluateAudio(audio, filename, contentType);
			if (!Number.isFinite(result.score) || result.score < 0 || result.score > 100) {
				throw new Error('ML service returned an invalid score');
			}
			await this.prisma.$transaction([
				this.prisma.submission.update({
					where: { id: submissionId },
					data: { status: EvaluationStatus.EVALUATED, processedAt: new Date(), errorMessage: null },
				}),
				this.prisma.evaluation.upsert({
					where: { submissionId },
					update: { score: result.score, feedback: this.feedbackFor(result.score), modelVersion: result.model_ready ? 'whisper-tiny-mlp' : 'baseline', evaluatedAt: new Date(), errorMessage: null },
					create: { submissionId, score: result.score, feedback: this.feedbackFor(result.score), modelVersion: result.model_ready ? 'whisper-tiny-mlp' : 'baseline', evaluatedAt: new Date() },
				}),
			]);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown evaluation error';
			await this.prisma.$transaction([
				this.prisma.submission.update({ where: { id: submissionId }, data: { status: EvaluationStatus.FAILED, processedAt: new Date(), errorMessage: message } }),
				this.prisma.evaluation.upsert({ where: { submissionId }, update: { score: null, feedback: null, errorMessage: message }, create: { submissionId, errorMessage: message } }),
			]);
		}
	}

	private feedbackFor(score: number): string {
		if (score >= 90) return 'Sangat Baik';
		if (score >= 80) return 'Baik';
		if (score >= 70) return 'Cukup';
		return 'Perlu Latihan';
	}

	private async getAudioMetadata(file: Express.Multer.File): Promise<FfprobeData> {
		const temporaryDirectory = await fs.mkdtemp(join(tmpdir(), 'yusro-audio-'));
		const temporaryPath = join(temporaryDirectory, file.originalname || 'recording');
		await fs.writeFile(temporaryPath, file.buffer);
		try {
			return await this.audioProcessing.getMetadata(temporaryPath);
		} catch {
			throw new BadRequestException('Audio file cannot be read');
		} finally {
			await fs.rm(temporaryDirectory, { recursive: true, force: true });
		}
	}
}
