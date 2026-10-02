import io
import math
import struct
import wave
import asyncio

from fastapi.testclient import TestClient
import pytest

from app.main import app
from app import main
from app.pipeline.whisper_encoder import ModelNotReadyError


client = TestClient(app)


def wav_bytes() -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        wav_file.writeframes(b''.join(struct.pack('<h', int(8_000 * math.sin(2 * math.pi * 440 * index / 16_000))) for index in range(48_000)))
    return buffer.getvalue()


def test_health(monkeypatch) -> None:
    monkeypatch.setattr(main, 'model_loaded', lambda: True)
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json() == {
        'status': 'ok',
        'model_version': main.settings.model_version,
        'model_loaded': True,
    }


def test_model_info(monkeypatch) -> None:
    monkeypatch.setattr(main, 'model_loaded', lambda: True)
    monkeypatch.setattr(main, 'artifact_summary', lambda: ('2026-09-22T00:00:00Z', {'mae': 1.0, 'pearson_correlation': 0.9, 'category_accuracy': 0.8}))
    response = client.get('/model-info')
    assert response.status_code == 200
    payload = response.json()
    assert payload['model_version'] == main.settings.model_version
    assert payload['whisper_version'] == main.settings.whisper_model
    assert payload['model_loaded'] is True
    assert payload['trained_at'] == '2026-09-22T00:00:00Z'


def test_evaluate_audio(monkeypatch) -> None:
    monkeypatch.setattr(main, 'encode_audio', lambda samples: __import__('numpy').ones(4))
    monkeypatch.setattr(main, 'transcribe_audio', lambda samples: 'test transcript')
    monkeypatch.setattr(main, 'evaluate_comparison', lambda features: 85.0)
    response = client.post(
        '/evaluate',
        data={'submission_id': 'b8c5b1ec-25e8-4d25-9f97-93c5b7e56b67'},
        files={
            'reference': ('reference.wav', wav_bytes(), 'audio/wav'),
            'recording': ('recording.wav', wav_bytes(), 'audio/wav'),
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['submission_id'] == 'b8c5b1ec-25e8-4d25-9f97-93c5b7e56b67'
    assert payload['model_version'] == main.settings.model_version
    assert payload['whisper_version'] == main.settings.whisper_model
    assert payload['processing_ms'] >= 0
    assert payload['score'] == 85
    assert payload['details']['duration_ratio'] == 1
    assert payload['details']['embedding_similarity'] == 1
    assert payload['details']['text_similarity'] == 1


def test_invalid_score_is_rejected(monkeypatch) -> None:
    monkeypatch.setattr(main, 'encode_audio', lambda samples: __import__('numpy').ones(4))
    monkeypatch.setattr(main, 'transcribe_audio', lambda samples: 'test transcript')
    monkeypatch.setattr(main, 'evaluate_comparison', lambda features: (_ for _ in ()).throw(ValueError('MLP returned an invalid score')))
    response = client.post(
        '/evaluate',
        data={'submission_id': 'b8c5b1ec-25e8-4d25-9f97-93c5b7e56b67'},
        files={'reference': ('reference.wav', wav_bytes(), 'audio/wav'), 'recording': ('recording.wav', wav_bytes(), 'audio/wav')},
    )
    assert response.status_code == 422
    assert response.json()['error_code'] == 'ML_BAD_REQUEST'
    assert 'invalid score' in response.json()['message']


def test_evaluation_failure_is_reported(monkeypatch) -> None:
    monkeypatch.setattr(main, 'encode_audio', lambda samples: (_ for _ in ()).throw(ModelNotReadyError('ML model unavailable')))
    response = client.post(
        '/evaluate',
        data={'submission_id': 'b8c5b1ec-25e8-4d25-9f97-93c5b7e56b67'},
        files={'reference': ('reference.wav', wav_bytes(), 'audio/wav'), 'recording': ('recording.wav', wav_bytes(), 'audio/wav')},
    )
    assert response.status_code == 503
    assert response.json()['error_code'] == 'ML_SERVICE_ERROR'
    assert response.json()['message'] == 'ML model unavailable'


def test_evaluate_accepts_approved_legacy_reference_header(monkeypatch) -> None:
    monkeypatch.setattr(main, 'encode_audio', lambda samples: __import__('numpy').ones(4))
    monkeypatch.setattr(main, 'transcribe_audio', lambda samples: 'test transcript')
    monkeypatch.setattr(main, 'evaluate_comparison', lambda features: 85.0)
    response = client.post(
        '/evaluate',
        data={'submission_id': 'b8c5b1ec-25e8-4d25-9f97-93c5b7e56b67'},
        headers={'X-Reference-Legacy-Resample': 'true'},
        files={
            'reference': ('reference.wav', wav_bytes(), 'audio/wav'),
            'recording': ('recording.wav', wav_bytes(), 'audio/wav'),
        },
    )
    assert response.status_code == 200


def test_evaluate_rejects_non_wav_before_model_inference() -> None:
    response = client.post(
        '/evaluate',
        data={'submission_id': 'b8c5b1ec-25e8-4d25-9f97-93c5b7e56b67'},
        files={'reference': ('reference.wav', b'not-a-wav', 'audio/wav'), 'recording': ('recording.wav', wav_bytes(), 'audio/wav')},
    )
    assert response.status_code == 400
    assert response.json()['error_code'] == 'AUDIO_DECODE_FAILED'
    assert 'RIFF/WAVE' in response.json()['message']


def test_startup_fails_when_whisper_cannot_load(monkeypatch) -> None:
    monkeypatch.setattr(main, 'configure_deterministic_inference', lambda: None)
    monkeypatch.setattr(main, 'validate_artifact', lambda: None)
    monkeypatch.setattr(main, 'load_whisper_model', lambda: (_ for _ in ()).throw(ModelNotReadyError('Whisper unavailable')))

    async def start() -> None:
        async with main.lifespan(main.app):
            pass

    with pytest.raises(ModelNotReadyError, match='Whisper unavailable'):
        asyncio.run(start())
