export interface MlHealthResponse {
	status: string;
	model_version: string;
	model_loaded: boolean;
}

export interface MlAudioInput {
	bytes: Uint8Array;
	filename: string;
	contentType: string;
}

export interface MlEvaluationRequest {
	submissionId: string;
	reference: MlAudioInput;
	recording: MlAudioInput;
	allowLegacyReferenceResample: boolean;
	requestId?: string;
}

export interface MlEvaluationResponse {
	submission_id: string;
	score: number;
	model_version: string;
	whisper_version: string;
	processing_ms: number;
	details: Record<string, number>;
}
