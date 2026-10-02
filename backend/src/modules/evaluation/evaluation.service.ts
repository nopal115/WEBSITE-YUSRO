import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { EvaluationStatus, JobStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../shared/database/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';
import { MlClientError, MlClientService } from '../ml-client/ml-client.service';
import { feedbackCategoryFor } from './domain/evaluation.rules';

const RETRY_DELAYS_MS = [10_000, 30_000, 60_000] as const;
const JOB_LOCK_STALE_AFTER_MS = 15 * 60_000;
const ATTEMPT_TIMEOUT_MS = 10 * 60_000;

@Injectable()
export class EvaluationService {
	private readonly logger = new Logger(EvaluationService.name);

	constructor(private readonly mlClient: MlClientService, private readonly prisma: PrismaService, private readonly storage: StorageService) {}

	async getReadiness(): Promise<{ status: 'ready'; evaluator: 'ml-service' }> {
		await this.mlClient.getHealth();
		return { status: 'ready', evaluator: 'ml-service' };
	}

	async retryByAdmin(adminId: string, attemptId: string) {
		return this.prisma.$transaction(async (tx) => {
			const attempt = await tx.attempt.findUnique({ where: { id: attemptId }, select: { id: true, evaluationStatus: true } });
			if (!attempt) throw new NotFoundException('Submission not found');
			if (attempt.evaluationStatus !== EvaluationStatus.FAILED) throw new ConflictException('EVAL_RETRY_NOT_ALLOWED');
			const reset = await tx.attempt.updateMany({
				where: { id: attemptId, evaluationStatus: EvaluationStatus.FAILED },
				data: { evaluationStatus: EvaluationStatus.SUBMITTED, errorCode: null, failedAt: null },
			});
			if (reset.count === 0) throw new ConflictException('EVAL_RETRY_NOT_ALLOWED');
			const job = await tx.evaluationJob.create({ data: { attemptId, isRetry: true, requestedById: adminId } });
			await tx.auditLog.create({ data: { actorId: adminId, action: 'EVALUATION_RETRY_REQUESTED', entityType: 'Attempt', entityId: attemptId } });
			return { submissionId: attemptId, jobId: job.id, status: EvaluationStatus.SUBMITTED };
		});
	}

	async getQueue() {
		const [jobs, grouped] = await Promise.all([
			this.prisma.evaluationJob.findMany({
			where: { status: { in: [JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.FAILED] } },
			orderBy: [{ runAfter: 'asc' }, { createdAt: 'asc' }],
			include: { attempt: { select: { id: true, userId: true, taskId: true, evaluationStatus: true, createdAt: true } } },
			}),
			this.prisma.evaluationJob.groupBy({ by: ['status'], _count: { _all: true } }),
		]);
		return {
			jobs,
			counts: Object.fromEntries(grouped.map(({ status, _count }) => [status, _count._all])),
		};
	}

	@Interval(Number(process.env.EVAL_WORKER_INTERVAL_MS ?? 2000))
	async processNextJob(): Promise<void> {
		const job = await this.prisma.$transaction(async (tx) => {
			const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "evaluation_jobs" WHERE status = 'QUEUED' AND "runAfter" <= now() ORDER BY "runAfter", "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
			if (!rows[0]) return null;
			const now = new Date();
			const workerId = process.env.EVAL_WORKER_ID ?? `worker-${process.pid}`;
			const claim = await tx.evaluationJob.updateMany({
				where: { id: rows[0].id, status: JobStatus.QUEUED, runAfter: { lte: now } },
				data: { status: JobStatus.RUNNING, startedAt: now, lockedAt: now, lockedBy: workerId, runCount: { increment: 1 } },
			});
			if (claim.count === 0) return null;
			const claimed = await tx.evaluationJob.findUniqueOrThrow({
				where: { id: rows[0].id }, include: { attempt: { include: { recordingAudio: true, referenceAudio: true } } },
			});
			const transition = await tx.attempt.updateMany({ where: { id: claimed.attemptId, evaluationStatus: EvaluationStatus.SUBMITTED }, data: { evaluationStatus: EvaluationStatus.PROCESSING, processingStartedAt: new Date() } });
			if (transition.count === 0) {
				await tx.evaluationJob.updateMany({ where: { id: claimed.id, status: JobStatus.RUNNING }, data: { status: JobStatus.FAILED, finishedAt: new Date(), lockedAt: null, lockedBy: null, lastErrorCode: 'EVAL_JOB_STALE', lastErrorDetail: 'Attempt is no longer awaiting evaluation' } });
				return null;
			}
			return claimed;
		});
		if (!job) return;
		const requestId = randomUUID();
		this.logger.log(`Evaluation job=${job.id} attempt=${job.attemptId} worker=${job.lockedBy ?? 'unknown'} run=${job.runCount} request=${requestId} claimed`);
		if (!job.attempt.recordingAudio || !job.attempt.referenceAudio) {
			await this.failJob(job.id, job.attemptId, 'EVAL_AUDIO_SNAPSHOT_MISSING', 'Recording or reference audio snapshot is missing');
			return;
		}
		try {
			const [recording, reference] = await Promise.all([
				this.storage.getObject(job.attempt.recordingAudio.objectKey),
				this.storage.getObject(job.attempt.referenceAudio.objectKey),
			]);
			const result = await this.mlClient.evaluate({
				submissionId: job.attemptId,
				requestId,
				allowLegacyReferenceResample: job.attempt.referenceAudio.allowLegacyResample,
				reference: {
					bytes: reference,
					filename: job.attempt.referenceAudio.originalName,
					contentType: job.attempt.referenceAudio.mimeType,
				},
				recording: {
					bytes: recording,
					filename: job.attempt.recordingAudio.originalName,
					contentType: job.attempt.recordingAudio.mimeType,
				},
			});
			this.assertValidMlResult(result);
			await this.completeJob(job.id, job.attemptId, job.attempt.userId, job.attempt.taskId, result);
			this.logger.log(`Evaluation job=${job.id} attempt=${job.attemptId} request=${requestId} completed model=${result.model_version} processingMs=${result.processing_ms}`);
		} catch (error) {
			const mlError = this.classifyError(error);
			const retry = mlError.retryable && job.runCount < job.maxRuns;
			this.logger.warn(`Evaluation job=${job.id} attempt=${job.attemptId} request=${requestId} code=${mlError.code} retry=${retry}`);
			await this.handleFailure(job.id, job.attemptId, job.runCount, retry, mlError);
		}
	}

	@Interval(60_000)
	async recoverStaleJobs(): Promise<void> {
		const cutoff = new Date(Date.now() - JOB_LOCK_STALE_AFTER_MS);
		const staleJobs = await this.prisma.evaluationJob.findMany({
			where: { status: JobStatus.RUNNING, lockedAt: { lt: cutoff } },
			select: { id: true, attemptId: true },
		});
		for (const staleJob of staleJobs) {
			await this.prisma.$transaction(async (tx) => {
				const recovered = await tx.evaluationJob.updateMany({
					where: { id: staleJob.id, status: JobStatus.RUNNING, lockedAt: { lt: cutoff } },
					data: { status: JobStatus.QUEUED, runAfter: new Date(), lockedAt: null, lockedBy: null, lastErrorCode: 'EVAL_WORKER_STALE', lastErrorDetail: 'Recovered after stale worker lock' },
				});
				if (recovered.count === 0) return;
				const resetAttempt = await tx.attempt.updateMany({
					where: { id: staleJob.attemptId, evaluationStatus: EvaluationStatus.PROCESSING },
					data: { evaluationStatus: EvaluationStatus.SUBMITTED, processingStartedAt: null },
				});
				if (resetAttempt.count === 0) {
					await tx.evaluationJob.updateMany({
						where: { id: staleJob.id, status: JobStatus.QUEUED },
						data: { status: JobStatus.FAILED, finishedAt: new Date(), lastErrorCode: 'EVAL_JOB_STALE', lastErrorDetail: 'Attempt is no longer processing' },
					});
				}
			});
		}
	}

	@Interval(60_000)
	async failTimedOutAttempts(): Promise<void> {
		const cutoff = new Date(Date.now() - ATTEMPT_TIMEOUT_MS);
		const attempts = await this.prisma.attempt.findMany({ where: { evaluationStatus: EvaluationStatus.PROCESSING, processingStartedAt: { lt: cutoff } }, select: { id: true } });
		if (!attempts.length) return;
		const ids = attempts.map(({ id }) => id);
		await this.prisma.$transaction([
			this.prisma.attempt.updateMany({ where: { id: { in: ids }, evaluationStatus: EvaluationStatus.PROCESSING }, data: { evaluationStatus: EvaluationStatus.FAILED, score: null, failedAt: new Date(), errorCode: 'ML_TIMEOUT' } }),
			this.prisma.evaluationJob.updateMany({ where: { attemptId: { in: ids }, status: JobStatus.RUNNING }, data: { status: JobStatus.FAILED, finishedAt: new Date(), lockedAt: null, lockedBy: null, lastErrorCode: 'ML_TIMEOUT', lastErrorDetail: 'Evaluation exceeded the 10 minute processing limit' } }),
		]);
	}

	private async completeJob(jobId: string, attemptId: string, userId: string, taskId: string, result: { score: number; model_version: string; processing_ms: number }): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const evaluatedAt = new Date();
			const completed = await tx.attempt.updateMany({
				where: { id: attemptId, evaluationStatus: EvaluationStatus.PROCESSING },
				data: { evaluationStatus: EvaluationStatus.EVALUATED, score: result.score, feedbackCategory: feedbackCategoryFor(result.score), modelVersion: result.model_version, evaluatedAt, processingMs: result.processing_ms },
			});
			if (completed.count === 0) return;
			const progress = await tx.taskProgress.findUnique({ where: { userId_taskId: { userId, taskId } }, select: { bestScore: true } });
			if (progress) {
				await tx.taskProgress.update({
					where: { userId_taskId: { userId, taskId } },
					data: { bestScore: Math.max(Number(progress.bestScore ?? 0), result.score) },
				});
			} else {
				await tx.taskProgress.create({ data: { userId, taskId, completedAt: evaluatedAt, firstAttemptAt: evaluatedAt, lastAttemptAt: evaluatedAt, attemptCount: 1, bestScore: result.score } });
			}
			const finished = await tx.evaluationJob.updateMany({ where: { id: jobId, status: JobStatus.RUNNING }, data: { status: JobStatus.DONE, finishedAt: evaluatedAt, lockedAt: null, lockedBy: null } });
			if (finished.count === 0) throw new ConflictException('EVAL_JOB_STATE_CONFLICT');
		});
	}

	private async handleFailure(jobId: string, attemptId: string, runCount: number, retry: boolean, error: MlClientError): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const active = await tx.attempt.findFirst({ where: { id: attemptId, evaluationStatus: EvaluationStatus.PROCESSING }, select: { id: true } });
			if (!active) return;
			if (retry) {
				const reset = await tx.attempt.updateMany({ where: { id: attemptId, evaluationStatus: EvaluationStatus.PROCESSING }, data: { evaluationStatus: EvaluationStatus.SUBMITTED, processingStartedAt: null } });
				if (reset.count === 0) return;
				const requeued = await tx.evaluationJob.updateMany({ where: { id: jobId, status: JobStatus.RUNNING }, data: { status: JobStatus.QUEUED, runAfter: new Date(Date.now() + (RETRY_DELAYS_MS[Math.min(runCount - 1, RETRY_DELAYS_MS.length - 1)] ?? RETRY_DELAYS_MS[0])), lastErrorCode: error.code, lastErrorDetail: this.errorDetail(error), lockedAt: null, lockedBy: null } });
				if (requeued.count === 0) throw new ConflictException('EVAL_JOB_STATE_CONFLICT');
				return;
			}
			const failed = await tx.attempt.updateMany({ where: { id: attemptId, evaluationStatus: EvaluationStatus.PROCESSING }, data: { evaluationStatus: EvaluationStatus.FAILED, score: null, failedAt: new Date(), errorCode: error.code } });
			if (failed.count === 0) return;
			const failedJob = await tx.evaluationJob.updateMany({ where: { id: jobId, status: JobStatus.RUNNING }, data: { status: JobStatus.FAILED, finishedAt: new Date(), lastErrorCode: error.code, lastErrorDetail: this.errorDetail(error), lockedAt: null, lockedBy: null } });
			if (failedJob.count === 0) throw new ConflictException('EVAL_JOB_STATE_CONFLICT');
		});
	}

	private async failJob(jobId: string, attemptId: string, code: string, detail: string): Promise<void> {
		await this.prisma.$transaction([
			this.prisma.attempt.updateMany({ where: { id: attemptId, evaluationStatus: EvaluationStatus.PROCESSING }, data: { evaluationStatus: EvaluationStatus.FAILED, score: null, failedAt: new Date(), errorCode: code } }),
			this.prisma.evaluationJob.updateMany({ where: { id: jobId, status: JobStatus.RUNNING }, data: { status: JobStatus.FAILED, finishedAt: new Date(), lastErrorCode: code, lastErrorDetail: detail, lockedAt: null, lockedBy: null } }),
		]);
	}

	private assertValidMlResult(result: { score: number; model_version: string; whisper_version: string; processing_ms: number }): void {
		if (!Number.isFinite(result.score) || result.score < 0 || result.score > 100 || !result.model_version || !result.whisper_version || !Number.isInteger(result.processing_ms) || result.processing_ms < 0) {
			throw new MlClientError('ML_INVALID_RESPONSE', false, 'ML service returned an invalid evaluation response');
		}
	}

	private classifyError(error: unknown): MlClientError {
		if (error instanceof MlClientError) return error;
		return new MlClientError('STORAGE_UNAVAILABLE', true, error instanceof Error ? error.message : 'Unable to retrieve evaluation audio');
	}

	private errorDetail(error: MlClientError): string {
		return error.message.slice(0, 1_000);
	}

}
