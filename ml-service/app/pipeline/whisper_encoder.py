from functools import lru_cache

import numpy as np

from ..config import settings


class ModelNotReadyError(RuntimeError):
	pass


@lru_cache(maxsize=1)
def _load_model():
	try:
		import whisper
	except ImportError as error:
		raise ModelNotReadyError('openai-whisper is not installed') from error
	try:
		return whisper.load_model(settings.whisper_model)
	except Exception as error:
		raise ModelNotReadyError(f'Whisper model is unavailable: {error}') from error


def load_whisper_model() -> None:
	"""Warm Whisper at startup so readiness never depends on the first request."""
	_load_model()


def configure_deterministic_inference() -> None:
	try:
		import torch
	except ImportError as error:
		raise ModelNotReadyError('torch is not installed') from error
	torch.manual_seed(0)
	if torch.cuda.is_available():
		torch.cuda.manual_seed_all(0)
		torch.backends.cudnn.benchmark = False
		torch.backends.cudnn.deterministic = True
	torch.use_deterministic_algorithms(True)


def encode_audio(samples: np.ndarray) -> np.ndarray:
	model = _load_model()
	import whisper
	import torch

	audio = torch.from_numpy(whisper.pad_or_trim(samples.astype(np.float32, copy=False)))
	mel = whisper.log_mel_spectrogram(audio, n_mels=model.dims.n_mels).to(model.device)
	with torch.no_grad():
		embedding = model.encoder(mel.unsqueeze(0)).mean(dim=1).squeeze(0).cpu().numpy()
	return embedding.astype(np.float32)


def transcribe_audio(samples: np.ndarray) -> str:
	model = _load_model()
	try:
		result = model.transcribe(samples.astype(np.float32, copy=False), fp16=False, language='ar', task='transcribe')
	except Exception as error:
		raise ModelNotReadyError(f'Whisper transcription failed: {error}') from error
	return str(result.get('text', '')).strip()
