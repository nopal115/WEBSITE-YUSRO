import { MlClientService } from './ml-client.service';

describe('MlClientService', () => {
	const evaluateRequest = {
		submissionId: 'attempt-1',
		reference: { bytes: Buffer.from('reference'), filename: 'reference.wav', contentType: 'audio/wav' },
		recording: { bytes: Buffer.from('recording'), filename: 'recording.wav', contentType: 'audio/wav' },
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
			json: async () => ({ submission_id: 'attempt-1', score: 85, model_version: 'model-1', whisper_version: 'tiny', processing_ms: 42, details: {} }),
		});

		const result = await new MlClientService().evaluate(evaluateRequest);
		const [, options] = fetchMock.mock.calls[0] as [string, { body: FormData }];

		expect(result.score).toBe(85);
		expect(options.body.get('submission_id')).toBe('attempt-1');
		expect((options.body.get('reference') as File).name).toBe('reference.wav');
		expect((options.body.get('recording') as File).name).toBe('recording.wav');
	});

	it('treats a malformed successful response as a permanent error', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ submission_id: 'another-attempt', score: 85, model_version: 'model-1' }),
		});

		await expect(new MlClientService().evaluate(evaluateRequest)).rejects.toEqual(
			expect.objectContaining({ code: 'ML_INVALID_RESPONSE', retryable: false }),
		);
	});

	it('maps a service error to a retryable failure', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 503 });

		await expect(new MlClientService().evaluate(evaluateRequest)).rejects.toEqual(
			expect.objectContaining({ code: 'ML_SERVICE_ERROR', retryable: true }),
		);
	});
});
