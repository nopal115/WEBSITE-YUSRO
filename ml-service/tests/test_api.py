import io
import wave

from fastapi.testclient import TestClient

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
        wav_file.writeframes(b'\x00\x00' * 16000)
    return buffer.getvalue()


def test_health() -> None:
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


def test_evaluate_audio(monkeypatch) -> None:
    monkeypatch.setattr(main, 'evaluate_audio', lambda samples, sample_rate, features: (85.0, 'good', 'test transcript'))
    response = client.post(
        '/evaluate',
        files={'audio': ('sample.wav', wav_bytes(), 'audio/wav')},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['filename'] == 'sample.wav'
    assert payload['sample_rate'] == 16000
    assert payload['model_ready'] is True
    assert payload['score'] == 85
    assert payload['transcript'] == 'test transcript'


def test_invalid_score_is_rejected(monkeypatch) -> None:
    monkeypatch.setattr(main, 'evaluate_audio', lambda samples, sample_rate, features: (_ for _ in ()).throw(ValueError('MLP returned an invalid score')))
    response = client.post('/evaluate', files={'audio': ('sample.wav', wav_bytes(), 'audio/wav')})
    assert response.status_code == 422
    assert 'invalid score' in response.json()['detail']


def test_evaluation_failure_is_reported(monkeypatch) -> None:
    monkeypatch.setattr(main, 'evaluate_audio', lambda samples, sample_rate, features: (_ for _ in ()).throw(ModelNotReadyError('ML model unavailable')))
    response = client.post('/evaluate', files={'audio': ('sample.wav', wav_bytes(), 'audio/wav')})
    assert response.status_code == 503
    assert response.json()['detail'] == 'ML model unavailable'
