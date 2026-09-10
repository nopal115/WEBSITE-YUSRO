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


def encode_audio(samples: np.ndarray) -> tuple[np.ndarray, str | None]:
	model = _load_model()
	import whisper
	import torch

	audio = torch.from_numpy(whisper.pad_or_trim(samples.astype(np.float32, copy=False)))
	mel = whisper.log_mel_spectrogram(audio, n_mels=model.dims.n_mels).to(model.device)
	with torch.no_grad():
		embedding = model.encoder(mel.unsqueeze(0)).mean(dim=1).squeeze(0).cpu().numpy()
	return embedding.astype(np.float32), None
