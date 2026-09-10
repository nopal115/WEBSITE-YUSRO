from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .config import settings
from .pipeline.features import extract_features
from .pipeline.mlp import evaluate_audio
from .pipeline.preprocess import decode_audio
from .schemas import EvaluationResponse
from .pipeline.whisper_encoder import ModelNotReadyError

app = FastAPI(title="Yusro ML Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post('/evaluate', response_model=EvaluationResponse)
async def evaluate(
    audio: UploadFile = File(...),
    reference_text: str | None = Form(default=None),
) -> EvaluationResponse:
    del reference_text
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail='Audio file is empty')
    if len(audio_bytes) > settings.max_audio_bytes:
        raise HTTPException(status_code=413, detail='Audio file is too large')
    try:
        samples, sample_rate = decode_audio(audio_bytes)
        features = extract_features(samples, sample_rate)
    except (RuntimeError, ValueError) as error:
        raise HTTPException(status_code=400, detail=f'Invalid audio file: {error}') from error
    duration = features['duration_seconds']
    if not settings.min_audio_seconds <= duration <= settings.max_audio_seconds:
        raise HTTPException(status_code=400, detail='Audio duration is outside the allowed range')
    try:
        score, label, transcript = evaluate_audio(samples, sample_rate, features)
    except ModelNotReadyError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return EvaluationResponse(
        filename=audio.filename or 'audio',
        duration_seconds=duration,
        sample_rate=sample_rate,
        features=features,
        score=score,
        label=label,
        transcript=transcript,
        model_ready=True,
    )
