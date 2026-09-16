from contextlib import asynccontextmanager
from time import perf_counter

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .config import settings
from .pipeline.features import COMPARISON_FEATURE_NAMES, comparison_features, extract_acoustic_features
from .pipeline.mlp import evaluate_comparison, validate_artifact
from .pipeline.preprocess import preprocess_wav_pcm16
from .schemas import EvaluationDetails, EvaluationResponse, HealthResponse, ModelInfoResponse
from .pipeline.whisper_encoder import ModelNotReadyError, encode_audio, transcribe_audio

startup_validation_error: str | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global startup_validation_error
    try:
        validate_artifact()
    except ModelNotReadyError as error:
        startup_validation_error = str(error)
    yield


app = FastAPI(title="Yusro ML Service", lifespan=lifespan)


FEATURE_NAMES = list(COMPARISON_FEATURE_NAMES)


def model_loaded() -> bool:
    if startup_validation_error is not None:
        return False
    try:
        validate_artifact()
        return True
    except ModelNotReadyError:
        return False




@app.get('/health', response_model=HealthResponse)
def health() -> HealthResponse | JSONResponse:
    loaded = model_loaded()
    if not loaded:
        return JSONResponse(
            status_code=503,
            content=HealthResponse(
                status='loading',
                model_version=settings.model_version,
                model_loaded=False,
            ).model_dump(),
        )
    return HealthResponse(status='ok', model_version=settings.model_version, model_loaded=True)


@app.get('/model-info', response_model=ModelInfoResponse)
def model_info() -> ModelInfoResponse:
    return ModelInfoResponse(
        model_version=settings.model_version,
        whisper_version=settings.whisper_model,
        features=FEATURE_NAMES,
        model_loaded=model_loaded(),
    )


@app.post('/evaluate', response_model=EvaluationResponse)
async def evaluate(
    submission_id: str = Form(...),
    reference: UploadFile = File(...),
    recording: UploadFile = File(...),
) -> EvaluationResponse:
    started_at = perf_counter()
    reference_bytes, recording_bytes = await reference.read(), await recording.read()
    if not reference_bytes or not recording_bytes:
        raise HTTPException(status_code=400, detail='Reference and recording audio are required')
    if len(reference_bytes) > settings.max_audio_bytes or len(recording_bytes) > settings.max_audio_bytes:
        raise HTTPException(status_code=413, detail='Audio file is too large')
    try:
        reference_samples, reference_sample_rate = preprocess_wav_pcm16(reference_bytes)
        recording_samples, recording_sample_rate = preprocess_wav_pcm16(recording_bytes)
        reference_features = extract_acoustic_features(reference_samples, reference_sample_rate)
        recording_features = extract_acoustic_features(recording_samples, recording_sample_rate)
    except (RuntimeError, ValueError) as error:
        raise HTTPException(status_code=400, detail=f'Invalid audio file: {error}') from error
    reference_duration = reference_features['duration_seconds']
    recording_duration = recording_features['duration_seconds']
    if not settings.min_audio_seconds <= reference_duration <= settings.max_audio_seconds:
        raise HTTPException(status_code=400, detail='Reference duration is outside the allowed range')
    if not settings.min_audio_seconds <= recording_duration <= settings.max_audio_seconds:
        raise HTTPException(status_code=400, detail='Audio duration is outside the allowed range')
    try:
        reference_embedding, recording_embedding = encode_audio(reference_samples), encode_audio(recording_samples)
        reference_text, recording_text = transcribe_audio(reference_samples), transcribe_audio(recording_samples)
        compared = comparison_features(reference_features, recording_features, reference_embedding, recording_embedding, reference_text, recording_text)
        score = evaluate_comparison(compared)
    except ModelNotReadyError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return EvaluationResponse(
        submission_id=submission_id,
        score=score,
        model_version=settings.model_version,
        whisper_version=settings.whisper_model,
        processing_ms=round((perf_counter() - started_at) * 1000),
        details=EvaluationDetails(
            reference_duration_ms=round(reference_duration * 1000),
            recording_duration_ms=round(recording_duration * 1000),
            duration_ratio=round(compared['duration_ratio'], 4),
            embedding_similarity=round(compared['embedding_cosine_similarity'], 4),
            text_similarity=round(compared['text_similarity'], 4),
        ),
    )
