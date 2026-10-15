"""Train a deterministic MLP only from an approved, offline feature export.

The input .npz must contain X (N x 8), y (0..100), split (train, validation,
test), and group_id. It is deliberately not a production-storage importer.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import torch
import torch.nn as nn

from app.pipeline.features import COMPARISON_FEATURE_NAMES

CATEGORY_THRESHOLDS = (60.0, 80.0)
HIDDEN_LAYERS = [16, 8]


def category(scores: np.ndarray) -> np.ndarray:
    return np.digitize(scores, CATEGORY_THRESHOLDS, right=False)


def metrics(predictions: np.ndarray, targets: np.ndarray) -> dict[str, float]:
    if len(predictions) == 0:
        raise ValueError('cannot calculate metrics for an empty split')
    pearson = 0.0 if np.std(predictions) == 0 or np.std(targets) == 0 else float(np.corrcoef(predictions, targets)[0, 1])
    return {
        'mae': float(np.mean(np.abs(predictions - targets))),
        'pearson_correlation': pearson,
        'category_accuracy': float(np.mean(category(predictions) == category(targets))),
    }


def load_export(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    with np.load(path, allow_pickle=False) as export:
        required = {'X', 'y', 'split', 'group_id', 'feature_names'}
        missing = required - set(export.files)
        if missing:
            raise ValueError(f'feature export is missing: {", ".join(sorted(missing))}')
        X, y = np.asarray(export['X'], dtype=np.float32), np.asarray(export['y'], dtype=np.float32)
        split, groups = export['split'].astype(str), export['group_id'].astype(str)
        names = tuple(export['feature_names'].astype(str))
    if names != COMPARISON_FEATURE_NAMES:
        raise ValueError('feature export order does not match the inference feature contract')
    if X.ndim != 2 or X.shape[1] != len(COMPARISON_FEATURE_NAMES) or len(X) != len(y) or len(y) != len(split) or len(split) != len(groups):
        raise ValueError('feature export dimensions are invalid')
    if not np.isfinite(X).all() or not np.isfinite(y).all() or np.any((y < 0) | (y > 100)):
        raise ValueError('feature export contains invalid values')
    if set(split) - {'train', 'validation', 'test'}:
        raise ValueError('split must contain only train, validation, or test')
    for group in np.unique(groups):
        if len(set(split[groups == group])) != 1:
            raise ValueError(f'group_id {group} appears in multiple splits')
    if any(not np.any(split == name) for name in ('train', 'validation', 'test')):
        raise ValueError('all train, validation, and test splits must be non-empty')
    return X, y, split, groups


def build_model() -> nn.Sequential:
    return nn.Sequential(
        nn.Linear(len(COMPARISON_FEATURE_NAMES), HIDDEN_LAYERS[0]), nn.ReLU(),
        nn.Linear(HIDDEN_LAYERS[0], HIDDEN_LAYERS[1]), nn.ReLU(),
        nn.Linear(HIDDEN_LAYERS[1], 1), nn.Sigmoid(),
    )


def train(args: argparse.Namespace) -> dict[str, Any]:
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.use_deterministic_algorithms(True)
    X, y, split, _ = load_export(args.features)
    train_mask, test_mask = split == 'train', split == 'test'
    mean, scale = X[train_mask].mean(axis=0), X[train_mask].std(axis=0)
    if np.any(scale == 0):
        raise ValueError('training split has a constant feature; scaler would be invalid')
    normalized = (X - mean) / scale
    model = build_model()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.learning_rate)
    criterion = nn.MSELoss()
    train_X = torch.from_numpy(normalized[train_mask])
    train_y = torch.from_numpy((y[train_mask] / 100).reshape(-1, 1))
    for _ in range(args.epochs):
        optimizer.zero_grad()
        loss = criterion(model(train_X), train_y)
        loss.backward()
        optimizer.step()
    with torch.no_grad():
        predictions = model(torch.from_numpy(normalized[test_mask])).squeeze(1).numpy() * 100
    result_metrics = metrics(predictions, y[test_mask])
    artifact = {
        'state_dict': model.state_dict(), 'model_version': args.model_version,
        'whisper_version': args.whisper_version, 'feature_names': list(COMPARISON_FEATURE_NAMES),
        'scaler': {'mean': mean.tolist(), 'scale': scale.tolist()}, 'hidden_layers': HIDDEN_LAYERS,
        'output': 'score_0_1', 'trained_at': datetime.now(UTC).isoformat().replace('+00:00', 'Z'),
        'metrics': result_metrics, 'dataset_version': args.dataset_version, 'split_seed': args.split_seed,
        'training_config': {'architecture': 'Linear(8,16,8,1)+ReLU+Sigmoid', 'epochs': args.epochs, 'learning_rate': args.learning_rate, 'optimizer': 'Adam', 'seed': args.seed},
        'experiment_id': args.experiment_id,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    torch.save(artifact, args.output)
    return result_metrics


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--features', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--dataset-version', required=True)
    parser.add_argument('--split-seed', type=int, default=42)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--experiment-id', required=True)
    parser.add_argument('--model-version', required=True)
    parser.add_argument('--whisper-version', default='tiny')
    parser.add_argument('--epochs', type=int, default=200)
    parser.add_argument('--learning-rate', type=float, default=1e-3)
    print(json.dumps(train(parser.parse_args()), sort_keys=True))


if __name__ == '__main__':
    main()
