export interface MlHealthResponse {
	status: string;
}

export interface MlEvaluationResponse {
	status: string;
	score: number;
	label: string;
	model_ready: boolean;
}
