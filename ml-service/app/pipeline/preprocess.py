from io import BytesIO
import wave

import numpy as np


SAMPLE_RATE = 16_000
SILENCE_THRESHOLD_DBFS = -40.0
TARGET_PEAK_DBFS = -1.0


class AudioFormatError(ValueError):
	pass


class SilentAudioError(ValueError):
	pass


def decode_wav_pcm16(audio_bytes: bytes) -> tuple[np.ndarray, int]:
	"""Accept exactly RIFF/WAVE PCM signed 16-bit, 16 kHz, mono audio."""
	if not audio_bytes.startswith(b'RIFF') or audio_bytes[8:12] != b'WAVE':
		raise AudioFormatError('Audio must be a RIFF/WAVE file')
	try:
		with wave.open(BytesIO(audio_bytes), 'rb') as source:
			if source.getcomptype() != 'NONE' or source.getsampwidth() != 2:
				raise AudioFormatError('WAV audio must be uncompressed PCM 16-bit')
			if source.getframerate() != SAMPLE_RATE or source.getnchannels() != 1:
				raise AudioFormatError('WAV audio must be 16 kHz mono')
			frames = source.readframes(source.getnframes())
	except (wave.Error, EOFError) as error:
		raise AudioFormatError('Invalid WAV audio') from error
	if not frames:
		raise AudioFormatError('Audio file is empty')
	samples = np.frombuffer(frames, dtype='<i2').astype(np.float32) / 32768.0
	if not np.isfinite(samples).all():
		raise AudioFormatError('Audio contains invalid numeric values')
	return samples, SAMPLE_RATE


def _trim_and_normalize(samples: np.ndarray, sample_rate: int, minimum_seconds: float) -> tuple[np.ndarray, int]:
	threshold = 10 ** (SILENCE_THRESHOLD_DBFS / 20.0)
	non_silent = np.flatnonzero(np.abs(samples) >= threshold)
	if non_silent.size == 0:
		raise SilentAudioError('Audio is silent')
	trimmed = samples[non_silent[0]:non_silent[-1] + 1]
	if len(trimmed) / sample_rate < minimum_seconds:
		raise AudioFormatError(f'Audio after silence trimming must be at least {minimum_seconds:g} second')
	peak = float(np.max(np.abs(trimmed)))
	if peak < threshold:
		raise SilentAudioError('Audio is silent')
	return (trimmed * ((10 ** (TARGET_PEAK_DBFS / 20.0)) / peak)).astype(np.float32, copy=False), sample_rate


def preprocess_wav_pcm16(
	audio_bytes: bytes,
	minimum_seconds: float = 1.0,
	minimum_source_seconds: float | None = None,
	maximum_source_seconds: float | None = None,
) -> tuple[np.ndarray, int]:
	samples, sample_rate = decode_wav_pcm16(audio_bytes)
	duration = len(samples) / sample_rate
	if minimum_source_seconds is not None and duration < minimum_source_seconds:
		raise AudioFormatError(f'Audio duration must be at least {minimum_source_seconds:g} seconds')
	if maximum_source_seconds is not None and duration > maximum_source_seconds:
		raise AudioFormatError(f'Audio duration must not exceed {maximum_source_seconds:g} seconds')
	return _trim_and_normalize(samples, sample_rate, minimum_seconds)


def preprocess_reference_audio(audio_bytes: bytes, *, allow_legacy_resample: bool, minimum_seconds: float = 1.0) -> tuple[np.ndarray, int]:
	"""Strict by default; only approved historical WAV references may be resampled."""
	try:
		return preprocess_wav_pcm16(audio_bytes, minimum_seconds)
	except AudioFormatError:
		if not allow_legacy_resample:
			raise
	try:
		import librosa
		import soundfile as sf
		info = sf.info(BytesIO(audio_bytes))
		if info.format != 'WAV' or info.subtype != 'PCM_16' or info.channels != 1:
			raise AudioFormatError('Historical reference must be WAV PCM 16-bit mono')
		samples, source_rate = sf.read(BytesIO(audio_bytes), dtype='float32', always_2d=False)
	except AudioFormatError:
		raise
	except Exception as error:
		raise AudioFormatError('Historical reference audio cannot be decoded') from error
	if source_rate == SAMPLE_RATE:
		return _trim_and_normalize(np.asarray(samples, dtype=np.float32), SAMPLE_RATE, minimum_seconds)
	resampled = librosa.resample(np.asarray(samples, dtype=np.float32), orig_sr=source_rate, target_sr=SAMPLE_RATE)
	return _trim_and_normalize(resampled, SAMPLE_RATE, minimum_seconds)
