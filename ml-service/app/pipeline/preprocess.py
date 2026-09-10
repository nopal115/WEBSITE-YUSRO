from io import BytesIO

import numpy as np
import librosa
import soundfile as sf


def decode_audio(audio_bytes: bytes) -> tuple[np.ndarray, int]:
	samples, sample_rate = sf.read(BytesIO(audio_bytes), dtype='float32', always_2d=False)
	if samples.size == 0:
		raise ValueError('Audio file is empty')
	if samples.ndim == 2:
		samples = np.mean(samples, axis=1)
	samples = samples.astype(np.float32, copy=False)
	if not np.isfinite(samples).all():
		raise ValueError('Audio contains invalid numeric values')
	if np.max(np.abs(samples)) > 0:
		samples = samples / np.max(np.abs(samples))
	if sample_rate != 16000:
		samples = librosa.resample(samples, orig_sr=sample_rate, target_sr=16000)
	return samples.astype(np.float32, copy=False), 16000
