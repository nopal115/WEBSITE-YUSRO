from pydantic import BaseModel, Field


class EvaluationResponse(BaseModel):
	status: str = 'ok'
	filename: str
	duration_seconds: float = Field(ge=0)
	sample_rate: int = Field(gt=0)
	features: dict[str, float]
	score: float = Field(ge=0, le=100)
	label: str
	transcript: str | None = None
	model_ready: bool = True
