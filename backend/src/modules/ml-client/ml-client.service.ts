import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  MlEvaluationRequest,
  MlEvaluationResponse,
  MlHealthResponse,
} from './domain/ml-client.types';

@Injectable()
export class MlClientService {
  private readonly baseUrl =
    process.env.ML_SERVICE_URL ?? 'http://localhost:8000';

  async getHealth(): Promise<MlHealthResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/, '')}/health`,
        {
          signal: AbortSignal.timeout(5_000),
        },
      );

      if (!response.ok) {
        throw new Error(`ML service returned HTTP ${response.status}`);
      }

      return (await response.json()) as MlHealthResponse;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown ML service error';
      throw new ServiceUnavailableException(
        `ML service unavailable: ${message}`,
      );
    }
  }

  async evaluate(request: MlEvaluationRequest): Promise<MlEvaluationResponse> {
    const form = new FormData();
    form.append('submission_id', request.submissionId);
    form.append(
      'reference',
      this.toBlob(request.reference.bytes, request.reference.contentType),
      request.reference.filename,
    );
    form.append(
      'recording',
      this.toBlob(request.recording.bytes, request.recording.contentType),
      request.recording.filename,
    );
    const requestId = request.requestId ?? randomUUID();
    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/, '')}/evaluate`,
        {
          method: 'POST',
          body: form,
          headers: {
            'X-Request-Id': requestId,
            'X-Reference-Legacy-Resample': String(
              request.allowLegacyReferenceResample,
            ),
          },
          signal: AbortSignal.timeout(120_000),
        },
      );
      if (response.status >= 500)
        throw new MlClientError(
          'ML_SERVICE_ERROR',
          true,
          `ML service returned HTTP ${response.status}`,
        );
      if (response.ok && response.status !== 200) {
        throw new MlClientError(
          'ML_INVALID_RESPONSE',
          false,
          `ML service returned unexpected HTTP ${response.status}`,
        );
      }
      if (!response.ok) {
        const failure = (await response.json().catch(() => null)) as {
          error_code?: string;
          message?: string;
        } | null;
        const code =
          failure?.error_code === 'AUDIO_DECODE_FAILED'
            ? 'AUDIO_DECODE_FAILED'
            : 'ML_BAD_REQUEST';
        throw new MlClientError(
          code,
          false,
          failure?.message || `ML service returned HTTP ${response.status}`,
        );
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new MlClientError(
          'ML_INVALID_RESPONSE',
          false,
          'ML service returned malformed JSON',
        );
      }
      if (!this.isValidEvaluationResponse(payload, request.submissionId)) {
        throw new MlClientError(
          'ML_INVALID_RESPONSE',
          false,
          'ML service returned an invalid response',
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof MlClientError) throw error;
      if (error instanceof DOMException && error.name === 'TimeoutError')
        throw new MlClientError(
          'ML_TIMEOUT_HTTP',
          true,
          'ML evaluation timed out',
        );
      const message =
        error instanceof Error ? error.message : 'Unknown ML evaluation error';
      throw new MlClientError(
        'ML_UNAVAILABLE',
        true,
        `ML evaluation failed: ${message}`,
      );
    }
  }

  private toBlob(bytes: Uint8Array, contentType: string): Blob {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return new Blob([buffer], { type: contentType });
  }

  private isValidEvaluationResponse(
    payload: unknown,
    submissionId: string,
  ): payload is MlEvaluationResponse {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return false;
    }
    const value = payload as Partial<MlEvaluationResponse>;
    return (
      value.submission_id === submissionId &&
      typeof value.score === 'number' &&
      Number.isFinite(value.score) &&
      value.score >= 0 &&
      value.score <= 100 &&
      this.isNonEmptyString(value.model_version) &&
      this.isNonEmptyString(value.whisper_version) &&
			typeof value.processing_ms === 'number' &&
      Number.isInteger(value.processing_ms) &&
      value.processing_ms >= 0 &&
      this.isNumericDetails(value.details)
    );
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private isNumericDetails(value: unknown): value is Record<string, number> {
    return !!value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item));
  }
}

export class MlClientError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
  }
}
