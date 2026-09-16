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


def preprocess_wav_pcm16(audio_bytes: bytes) -> tuple[np.ndarray, int]:
	samples, sample_rate = decode_wav_pcm16(audio_bytes)
	threshold = 10 ** (SILENCE_THRESHOLD_DBFS / 20.0)
	non_silent = np.flatnonzero(np.abs(samples) >= threshold)
	if non_silent.size == 0:
		raise SilentAudioError('Audio is silent')
	trimmed = samples[non_silent[0]:non_silent[-1] + 1]
	peak = float(np.max(np.abs(trimmed)))
	if peak < threshold:
		raise SilentAudioError('Audio is silent')
	return (trimmed * ((10 ** (TARGET_PEAK_DBFS / 20.0)) / peak)).astype(np.float32, copy=False), sample_rate
