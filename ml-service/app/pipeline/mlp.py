from functools import lru_cache
from pathlib import Path

import numpy as np

from ..config import settings
from .whisper_encoder import ModelNotReadyError, encode_audio


@lru_cache(maxsize=1)
def _load_mlp():
	try:
		import torch
		import torch.nn as nn
	except ImportError as error:
		raise ModelNotReadyError('torch is not installed') from error
	checkpoint = Path(settings.mlp_checkpoint)
	if not checkpoint.exists():
		raise ModelNotReadyError(f'MLP checkpoint not found: {checkpoint}')
	model = nn.Sequential(nn.Linear(390, 128), nn.ReLU(), nn.Linear(128, 1), nn.Sigmoid())
	try:
		model.load_state_dict(torch.load(checkpoint, map_location='cpu', weights_only=True))
	except Exception as error:
		raise ModelNotReadyError(f'MLP checkpoint is invalid: {error}') from error
	model.eval()
	return model


def evaluate_audio(samples: np.ndarray, sample_rate: int, features: dict[str, float]) -> tuple[float, str, str | None]:
	embedding, transcript = encode_audio(samples)
	vector = np.concatenate([embedding, np.array([
		features['rms'],
		features['zero_crossing_rate'],
		features['spectral_centroid_hz'] / sample_rate,
		features['mel_mean_db'] / 100,
		features['mel_std_db'] / 100,
		features['duration_seconds'] / 30,
	], dtype=np.float32)])
	import torch
	with torch.no_grad():
		raw_score = float(_load_mlp()(torch.from_numpy(vector).unsqueeze(0)).item() * 100)
	if not np.isfinite(raw_score) or not 0 <= raw_score <= 100:
		raise ValueError('MLP returned an invalid score')
	score = round(raw_score, 2)
	label = 'good' if score >= 70 else 'needs_review'
	return score, label, transcript
