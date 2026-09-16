import { EvaluationStatus, JobStatus } from '@prisma/client';
import { EvaluationService } from './evaluation.service';
import { MlClientError } from '../ml-client/ml-client.service';

describe('EvaluationService worker rules', () => {
	const createService = () => {
		const tx = {
			$queryRaw: jest.fn(),
			attempt: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
			evaluationJob: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
			auditLog: { create: jest.fn() },
		};
		const prisma = {
			$transaction: jest.fn(async (work: unknown) => typeof work === 'function' ? (work as (client: typeof tx) => unknown)(tx) : Promise.all(work as Promise<unknown>[])),
			attempt: { findMany: jest.fn(), updateMany: jest.fn() },
			evaluationJob: { updateMany: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
		};
		const mlClient = { evaluate: jest.fn(), getHealth: jest.fn() };
		const storage = { getObject: jest.fn() };
		return { service: new EvaluationService(mlClient as never, prisma as never, storage as never), prisma, tx, mlClient, storage };
	};

	it('requeues only retryable errors and restores SUBMITTED before retrying', async () => {
		const { service, tx } = createService();
		tx.attempt.findFirst.mockResolvedValue({ id: 'attempt-1' });
		tx.attempt.update.mockResolvedValue({});
		tx.evaluationJob.updateMany.mockResolvedValue({ count: 1 });

		await (service as never as { handleFailure: (job: string, attempt: string, run: number, retry: boolean, error: MlClientError) => Promise<void> })
			.handleFailure('job-1', 'attempt-1', 1, true, new MlClientError('ML_UNAVAILABLE', true, 'offline'));

		expect(tx.attempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ evaluationStatus: EvaluationStatus.SUBMITTED, processingStartedAt: null }) }));
		expect(tx.evaluationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: JobStatus.QUEUED, lastErrorCode: 'ML_UNAVAILABLE' }) }));
	});

	it('fails permanently without changing score to zero', async () => {
		const { service, tx } = createService();
		tx.attempt.findFirst.mockResolvedValue({ id: 'attempt-1' });
		tx.attempt.update.mockResolvedValue({});
		tx.evaluationJob.updateMany.mockResolvedValue({ count: 1 });

		await (service as never as { handleFailure: (job: string, attempt: string, run: number, retry: boolean, error: MlClientError) => Promise<void> })
			.handleFailure('job-1', 'attempt-1', 1, false, new MlClientError('ML_INVALID_RESPONSE', false, 'bad response'));

		expect(tx.attempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ evaluationStatus: EvaluationStatus.FAILED, score: null, errorCode: 'ML_INVALID_RESPONSE' }) }));
		expect(tx.evaluationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: JobStatus.FAILED }) }));
	});

	it('marks processing attempts older than ten minutes as ML_TIMEOUT', async () => {
		const { service, prisma } = createService();
		prisma.attempt.findMany.mockResolvedValue([{ id: 'attempt-1' }]);
		prisma.attempt.updateMany.mockResolvedValue({ count: 1 });
		prisma.evaluationJob.updateMany.mockResolvedValue({ count: 1 });

		await service.failTimedOutAttempts();

		expect(prisma.attempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ evaluationStatus: EvaluationStatus.FAILED, score: null, errorCode: 'ML_TIMEOUT' }) }));
		expect(prisma.evaluationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: JobStatus.FAILED, lastErrorCode: 'ML_TIMEOUT' }) }));
	});

	it('requeues a stale worker lock and restores the attempt to SUBMITTED', async () => {
		const { service, prisma, tx } = createService();
		prisma.evaluationJob.findMany.mockResolvedValue([{ id: 'job-1', attemptId: 'attempt-1' }]);
		tx.evaluationJob.updateMany.mockResolvedValue({ count: 1 });
		tx.attempt.updateMany.mockResolvedValue({ count: 1 });

		await service.recoverStaleJobs();

		expect(tx.evaluationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: JobStatus.QUEUED, lastErrorCode: 'EVAL_WORKER_STALE' }) }));
		expect(tx.attempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { evaluationStatus: EvaluationStatus.SUBMITTED, processingStartedAt: null } }));
	});

	it('does not evaluate a job when its attempt is no longer SUBMITTED', async () => {
		const { service, tx, mlClient } = createService();
		tx.$queryRaw.mockResolvedValue([{ id: 'job-1' }]);
		tx.evaluationJob.update.mockResolvedValue({
			id: 'job-1', attemptId: 'attempt-1', runCount: 1, maxRuns: 3,
			attempt: { recordingAudio: { objectKey: 'recording.wav' }, referenceAudio: { objectKey: 'reference.wav' } },
		});
		tx.attempt.updateMany.mockResolvedValue({ count: 0 });

		await service.processNextJob();

		expect(mlClient.evaluate).not.toHaveBeenCalled();
		expect(tx.evaluationJob.update).toHaveBeenLastCalledWith(expect.objectContaining({
			data: expect.objectContaining({ status: JobStatus.FAILED, lastErrorCode: 'EVAL_JOB_STALE' }),
		}));
	});

	it('sends both audio snapshots to ML and completes a claimed job', async () => {
		const { service, tx, storage, mlClient } = createService();
		tx.$queryRaw.mockResolvedValue([{ id: 'job-1' }]);
		tx.evaluationJob.update.mockResolvedValue({
			id: 'job-1', attemptId: 'attempt-1', runCount: 1, maxRuns: 3,
			attempt: {
				recordingAudio: { objectKey: 'recording.wav', originalName: 'recording.wav', mimeType: 'audio/wav' },
				referenceAudio: { objectKey: 'reference.wav', originalName: 'reference.wav', mimeType: 'audio/wav' },
			},
		});
		tx.attempt.updateMany.mockResolvedValue({ count: 1 });
		storage.getObject.mockResolvedValueOnce(Buffer.from('recording')).mockResolvedValueOnce(Buffer.from('reference'));
		mlClient.evaluate.mockResolvedValue({ submission_id: 'attempt-1', score: 85, model_version: 'model-1', whisper_version: 'tiny', processing_ms: 42, details: {} });

		await service.processNextJob();

		expect(mlClient.evaluate).toHaveBeenCalledWith(expect.objectContaining({
			submissionId: 'attempt-1',
			recording: expect.objectContaining({ bytes: Buffer.from('recording') }),
			reference: expect.objectContaining({ bytes: Buffer.from('reference') }),
		}));
		expect(tx.attempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
			evaluationStatus: EvaluationStatus.EVALUATED, score: 85, feedbackCategory: 'BAIK', modelVersion: 'model-1', processingMs: 42,
		}) }));
		expect(tx.evaluationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: JobStatus.DONE }) }));
	});

	it('creates an auditable retry only for a failed attempt', async () => {
		const { service, tx } = createService();
		tx.attempt.findUnique.mockResolvedValue({ id: 'attempt-1', evaluationStatus: EvaluationStatus.FAILED });
		tx.attempt.update.mockResolvedValue({});
		tx.evaluationJob.create.mockResolvedValue({ id: 'job-2' });

		await expect(service.retryByAdmin('admin-1', 'attempt-1')).resolves.toEqual({
			submissionId: 'attempt-1', jobId: 'job-2', status: EvaluationStatus.SUBMITTED,
		});
		expect(tx.evaluationJob.create).toHaveBeenCalledWith({ data: { attemptId: 'attempt-1', isRetry: true, requestedById: 'admin-1' } });
		expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'EVALUATION_RETRY_REQUESTED' }) }));
	});

	it('rejects an admin retry when the attempt has not failed', async () => {
		const { service, tx } = createService();
		tx.attempt.findUnique.mockResolvedValue({ id: 'attempt-1', evaluationStatus: EvaluationStatus.EVALUATED });

		await expect(service.retryByAdmin('admin-1', 'attempt-1')).rejects.toThrow('EVAL_RETRY_NOT_ALLOWED');
		expect(tx.evaluationJob.create).not.toHaveBeenCalled();
	});
});
