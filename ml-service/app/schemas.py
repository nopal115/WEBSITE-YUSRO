from pydantic import BaseModel, Field


class EvaluationDetails(BaseModel):
	reference_duration_ms: int = Field(ge=0)
	recording_duration_ms: int = Field(ge=0)
	duration_ratio: float = Field(ge=0)
	embedding_similarity: float = Field(ge=0, le=1)
	text_similarity: float = Field(ge=0, le=1)


class EvaluationResponse(BaseModel):
	submission_id: str
	score: float = Field(ge=0, le=100)
	model_version: str
	whisper_version: str
	processing_ms: int = Field(ge=0)
	details: EvaluationDetails


class HealthResponse(BaseModel):
	status: str
	model_version: str
	model_loaded: bool


class ModelInfoResponse(BaseModel):
	model_version: str
	whisper_version: str
	features: list[str]
	model_loaded: bool
	trained_at: str | None = None
	metrics: dict[str, float] | None = None
