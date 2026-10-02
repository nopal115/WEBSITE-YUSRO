from functools import lru_cache
from pathlib import Path
from datetime import datetime
import re

import numpy as np

from ..config import settings
from .features import COMPARISON_FEATURE_NAMES, vectorize_comparison_features
from .whisper_encoder import ModelNotReadyError


class ModelArtifactError(ModelNotReadyError):
	pass


@lru_cache(maxsize=1)
def _load_artifact() -> dict:
	try:
		import torch
		import torch.nn as nn
	except ImportError as error:
		raise ModelNotReadyError('torch is not installed') from error
	checkpoint = Path(settings.mlp_checkpoint)
	if not checkpoint.exists():
		raise ModelNotReadyError(f'MLP checkpoint not found: {checkpoint}')
	try:
		artifact = torch.load(checkpoint, map_location='cpu', weights_only=True)
	except Exception as error:
		raise ModelArtifactError(f'MLP checkpoint is invalid: {error}') from error
	if not isinstance(artifact, dict):
		raise ModelArtifactError('MLP artifact must include metadata')
	required = {'state_dict', 'model_version', 'whisper_version', 'feature_names', 'scaler', 'hidden_layers', 'output', 'trained_at', 'metrics', 'dataset_version', 'split_seed', 'training_config', 'experiment_id'}
	if missing := required.difference(artifact):
		raise ModelArtifactError(f'MLP artifact is missing: {", ".join(sorted(missing))}')
	if artifact['model_version'] != settings.model_version or artifact['whisper_version'] != settings.whisper_model:
		raise ModelArtifactError('MLP artifact model or Whisper version is incompatible')
	if not re.fullmatch(r'yusro-mlp-v\d+\.\d+\.\d+', str(artifact['model_version'])):
		raise ModelArtifactError('MLP artifact model_version must follow yusro-mlp-vMAJOR.MINOR.PATCH')
	if not isinstance(artifact['trained_at'], str):
		raise ModelArtifactError('MLP artifact trained_at is invalid')
	try:
		datetime.fromisoformat(artifact['trained_at'].replace('Z', '+00:00'))
	except ValueError as error:
		raise ModelArtifactError('MLP artifact trained_at is invalid') from error
	metrics = artifact['metrics']
	if not isinstance(metrics, dict) or not {'mae', 'pearson_correlation', 'category_accuracy'}.issubset(metrics) or not all(isinstance(value, (int, float)) and np.isfinite(value) for value in metrics.values()):
		raise ModelArtifactError('MLP artifact metrics are invalid')
	if tuple(artifact['feature_names']) != COMPARISON_FEATURE_NAMES or artifact['output'] != 'score_0_1':
		raise ModelArtifactError('MLP artifact feature contract is incompatible')
	scaler = artifact['scaler']
	if not isinstance(scaler, dict) or len(scaler.get('mean', [])) != len(COMPARISON_FEATURE_NAMES) or len(scaler.get('scale', [])) != len(COMPARISON_FEATURE_NAMES):
		raise ModelArtifactError('MLP artifact scaler is incompatible')
	if not np.isfinite(np.asarray(scaler['mean'], dtype=np.float32)).all() or np.any(np.asarray(scaler['scale'], dtype=np.float32) <= 0):
		raise ModelArtifactError('MLP artifact scaler contains invalid values')
	if not isinstance(artifact['hidden_layers'], list) or not all(isinstance(size, int) and size > 0 for size in artifact['hidden_layers']):
		raise ModelArtifactError('MLP artifact hidden_layers is invalid')
	if not isinstance(artifact['dataset_version'], str) or not artifact['dataset_version'] or not isinstance(artifact['split_seed'], int) or not isinstance(artifact['training_config'], dict) or not isinstance(artifact['experiment_id'], str) or not artifact['experiment_id']:
		raise ModelArtifactError('MLP artifact training provenance is invalid')
	return artifact


@lru_cache(maxsize=1)
def _load_mlp():
	import torch.nn as nn
	artifact = _load_artifact()
	layers: list[nn.Module] = []
	input_size = len(COMPARISON_FEATURE_NAMES)
	for hidden_size in artifact['hidden_layers']:
		layers.extend([nn.Linear(input_size, hidden_size), nn.ReLU()])
		input_size = hidden_size
	model = nn.Sequential(*layers, nn.Linear(input_size, 1), nn.Sigmoid())
	try:
		model.load_state_dict(artifact['state_dict'])
	except Exception as error:
		raise ModelArtifactError('MLP state_dict does not match metadata architecture') from error
	model.eval()
	return model


def validate_artifact() -> None:
	# Metadata alone is insufficient: a stale state_dict can still be incompatible
	# with the declared architecture. Constructing the model makes startup fail
	# before this service accepts evaluation requests.
	_load_mlp()


def artifact_summary() -> tuple[str, dict[str, float]]:
	artifact = _load_artifact()
	return artifact['trained_at'], artifact['metrics']


def evaluate_comparison(features: dict[str, float]) -> float:
	vector = vectorize_comparison_features(features)
	scaler = _load_artifact()['scaler']
	vector = (vector - np.asarray(scaler['mean'], dtype=np.float32)) / np.asarray(scaler['scale'], dtype=np.float32)
	import torch
	with torch.no_grad():
		raw_score = float(_load_mlp()(torch.from_numpy(vector).unsqueeze(0)).item() * 100)
	if not np.isfinite(raw_score) or not 0 <= raw_score <= 100:
		raise ValueError('MLP returned an invalid score')
	return round(raw_score, 2)
