import io
import struct
import wave

import numpy as np
import pytest

from app.pipeline.preprocess import AudioFormatError, SilentAudioError, preprocess_reference_audio, preprocess_wav_pcm16


def make_wav(samples: list[int], *, sample_rate: int = 16_000, sample_width: int = 2) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(sample_width)
        audio.setframerate(sample_rate)
        if sample_width == 2:
            audio.writeframes(b''.join(struct.pack('<h', sample) for sample in samples))
        else:
            audio.writeframes(bytes(len(samples) * sample_width))
    return buffer.getvalue()


def test_preprocess_rejects_non_16khz_wav() -> None:
    with pytest.raises(AudioFormatError, match='16 kHz'):
        preprocess_wav_pcm16(make_wav([1_000] * 32_000, sample_rate=8_000))


def test_preprocess_rejects_silence() -> None:
    with pytest.raises(SilentAudioError, match='silent'):
        preprocess_wav_pcm16(make_wav([0] * 32_000))


def test_preprocess_trims_and_normalizes_to_minus_one_dbfs() -> None:
    samples, sample_rate = preprocess_wav_pcm16(
        make_wav([0] * 100 + [4_000] * 400 + [0] * 100),
        minimum_seconds=0.01,
    )
    assert sample_rate == 16_000
    assert len(samples) == 400
    assert np.max(np.abs(samples)) == pytest.approx(10 ** (-1 / 20), abs=1e-6)


def test_preprocess_rejects_audio_shorter_than_one_second_after_trim() -> None:
    with pytest.raises(AudioFormatError, match='at least 1 second'):
        preprocess_wav_pcm16(make_wav([0] * 100 + [4_000] * 8_000 + [0] * 100))


def test_preprocess_rejects_source_duration_outside_recording_contract() -> None:
    with pytest.raises(AudioFormatError, match='at least 2 seconds'):
        preprocess_wav_pcm16(
            make_wav([4_000] * 16_000),
            minimum_source_seconds=2,
            maximum_source_seconds=60,
        )
    with pytest.raises(AudioFormatError, match='not exceed 60 seconds'):
        preprocess_wav_pcm16(
            make_wav([4_000] * (60 * 16_000 + 1)),
            minimum_source_seconds=2,
            maximum_source_seconds=60,
        )


def test_only_approved_historical_reference_may_be_resampled() -> None:
    legacy_reference = make_wav([4_000] * 8_000, sample_rate=8_000)
    with pytest.raises(AudioFormatError, match='16 kHz'):
        preprocess_reference_audio(legacy_reference, allow_legacy_resample=False)
    samples, sample_rate = preprocess_reference_audio(legacy_reference, allow_legacy_resample=True)
    assert sample_rate == 16_000
    assert len(samples) == 16_000
