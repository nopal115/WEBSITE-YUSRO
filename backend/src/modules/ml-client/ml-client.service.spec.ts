import { MlClientService } from './ml-client.service';

describe('MlClientService', () => {
  const evaluateRequest = {
    submissionId: 'attempt-1',
    allowLegacyReferenceResample: false,
    reference: {
      bytes: Buffer.from('reference'),
      filename: 'reference.wav',
      contentType: 'audio/wav',
    },
    recording: {
      bytes: Buffer.from('recording'),
      filename: 'recording.wav',
      contentType: 'audio/wav',
    },
  };
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses the two-file evaluation contract and returns a valid ML response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        submission_id: 'attempt-1',
        score: 85,
        model_version: 'model-1',
        whisper_version: 'tiny',
        processing_ms: 42,
        details: {},
      }),
    });

    const result = await new MlClientService().evaluate(evaluateRequest);
    const [, options] = fetchMock.mock.calls[0] as [
      string,
      { body: FormData; headers: Record<string, string> },
    ];

    expect(result.score).toBe(85);
    expect(options.body.get('submission_id')).toBe('attempt-1');
    expect(options.headers).toMatchObject({
      'X-Reference-Legacy-Resample': 'false',
    });
		expect(options.headers['X-Request-Id']).toEqual(expect.any(String));
    expect((options.body.get('reference') as File).name).toBe('reference.wav');
    expect((options.body.get('recording') as File).name).toBe('recording.wav');
  });

  it('treats a malformed successful response as a permanent error', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        submission_id: 'another-attempt',
        score: 85,
        model_version: 'model-1',
      }),
    });

    await expect(
      new MlClientService().evaluate(evaluateRequest),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'ML_INVALID_RESPONSE',
        retryable: false,
      }),
    );
  });

  it('maps a service error to a retryable failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    await expect(
      new MlClientService().evaluate(evaluateRequest),
    ).rejects.toEqual(
      expect.objectContaining({ code: 'ML_SERVICE_ERROR', retryable: true }),
    );
  });

  it('preserves an audio decode error as a non-retryable contract error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error_code: 'AUDIO_DECODE_FAILED',
        message: 'Audio cannot be decoded',
      }),
    });

    await expect(
      new MlClientService().evaluate(evaluateRequest),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'AUDIO_DECODE_FAILED',
        retryable: false,
      }),
    );
  });

	it.each([
		{ whisper_version: '' },
		{ processing_ms: -1 },
		{ details: { duration_ratio: 'invalid' } },
	])('rejects an incomplete or invalid successful response: %o', async (override) => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				submission_id: 'attempt-1', score: 85, model_version: 'model-1', whisper_version: 'tiny', processing_ms: 42, details: {}, ...override,
			}),
		});

		await expect(new MlClientService().evaluate(evaluateRequest)).rejects.toEqual(
			expect.objectContaining({ code: 'ML_INVALID_RESPONSE', retryable: false }),
		);
	});

	it('maps malformed successful JSON to a permanent invalid-response error', async () => {
		fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('invalid json'); } });

		await expect(new MlClientService().evaluate(evaluateRequest)).rejects.toEqual(
			expect.objectContaining({ code: 'ML_INVALID_RESPONSE', retryable: false }),
		);
	});

  it('maps a generic 4xx response to a permanent bad-request error', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 422, json: async () => ({ message: 'invalid request' }) });

		await expect(new MlClientService().evaluate(evaluateRequest)).rejects.toEqual(
			expect.objectContaining({ code: 'ML_BAD_REQUEST', retryable: false }),
		);
  });

	it('rejects an unexpected successful HTTP status as an invalid response', async () => {
		fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({
			submission_id: 'attempt-1', score: 85, model_version: 'model-1', whisper_version: 'tiny', processing_ms: 42, details: {},
		}) });

		await expect(new MlClientService().evaluate(evaluateRequest)).rejects.toEqual(
			expect.objectContaining({ code: 'ML_INVALID_RESPONSE', retryable: false }),
		);
	});

	it('maps a timeout and connection failure to their retryable error codes', async () => {
		fetchMock.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'));
		await expect(new MlClientService().evaluate(evaluateRequest)).rejects.toEqual(
			expect.objectContaining({ code: 'ML_TIMEOUT_HTTP', retryable: true }),
		);

		fetchMock.mockRejectedValueOnce(new Error('connection refused'));
		await expect(new MlClientService().evaluate(evaluateRequest)).rejects.toEqual(
			expect.objectContaining({ code: 'ML_UNAVAILABLE', retryable: true }),
		);
	});
});
