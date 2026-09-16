import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MlEvaluationRequest, MlEvaluationResponse, MlHealthResponse } from './domain/ml-client.types';

@Injectable()
export class MlClientService {
	private readonly baseUrl = process.env.ML_SERVICE_URL ?? 'http://localhost:8000';

	async getHealth(): Promise<MlHealthResponse> {
		try {
			const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/health`, {
				signal: AbortSignal.timeout(5_000),
			});

			if (!response.ok) {
				throw new Error(`ML service returned HTTP ${response.status}`);
			}

			return (await response.json()) as MlHealthResponse;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown ML service error';
			throw new ServiceUnavailableException(`ML service unavailable: ${message}`);
		}
	}

	async evaluate(request: MlEvaluationRequest): Promise<MlEvaluationResponse> {
		const form = new FormData();
		form.append('submission_id', request.submissionId);
		form.append('reference', this.toBlob(request.reference.bytes, request.reference.contentType), request.reference.filename);
		form.append('recording', this.toBlob(request.recording.bytes, request.recording.contentType), request.recording.filename);
		try {
			const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/evaluate`, {
				method: 'POST',
				body: form,
				signal: AbortSignal.timeout(120_000),
			});
			if (response.status >= 500) throw new MlClientError('ML_SERVICE_ERROR', true, `ML service returned HTTP ${response.status}`);
			if (!response.ok) throw new MlClientError('ML_BAD_REQUEST', false, `ML service returned HTTP ${response.status}`);
			const payload = (await response.json()) as Partial<MlEvaluationResponse>;
			if (!Number.isFinite(payload.score) || payload.score! < 0 || payload.score! > 100 || !payload.model_version || payload.submission_id !== request.submissionId) {
				throw new MlClientError('ML_INVALID_RESPONSE', false, 'ML service returned an invalid response');
			}
			return payload as MlEvaluationResponse;
		} catch (error) {
			if (error instanceof MlClientError) throw error;
			if (error instanceof DOMException && error.name === 'TimeoutError') throw new MlClientError('ML_TIMEOUT_HTTP', true, 'ML evaluation timed out');
			const message = error instanceof Error ? error.message : 'Unknown ML evaluation error';
			throw new MlClientError('ML_UNAVAILABLE', true, `ML evaluation failed: ${message}`);
		}
	}

	private toBlob(bytes: Uint8Array, contentType: string): Blob {
		const buffer = new ArrayBuffer(bytes.byteLength);
		new Uint8Array(buffer).set(bytes);
		return new Blob([buffer], { type: contentType });
	}
}

export class MlClientError extends Error {
	constructor(readonly code: string, readonly retryable: boolean, message: string) {
		super(message);
	}
}
