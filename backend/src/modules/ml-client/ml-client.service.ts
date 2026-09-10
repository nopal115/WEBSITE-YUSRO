import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MlEvaluationResponse, MlHealthResponse } from './domain/ml-client.types';

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

	async evaluateAudio(audio: Uint8Array, filename: string, contentType: string): Promise<MlEvaluationResponse> {
		const form = new FormData();
		const audioBuffer = new ArrayBuffer(audio.byteLength);
		new Uint8Array(audioBuffer).set(audio);
		form.append('audio', new Blob([audioBuffer], { type: contentType }), filename);
		try {
			const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/evaluate`, {
				method: 'POST',
				body: form,
				signal: AbortSignal.timeout(120_000),
			});
			if (!response.ok) throw new Error(`ML service returned HTTP ${response.status}`);
			return (await response.json()) as MlEvaluationResponse;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown ML evaluation error';
			throw new ServiceUnavailableException(`ML evaluation failed: ${message}`);
		}
	}
}
