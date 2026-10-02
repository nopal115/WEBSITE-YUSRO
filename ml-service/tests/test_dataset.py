import json

import numpy as np
import pytest

from scripts.prepare_dataset import load_records, split_records, write_splits
from scripts.train_mlp import load_export, metrics


def records_for_groups() -> list[dict]:
    return [
        {
            'id': f'sample-{index}',
            'group_id': f'student-{index}',
            'recording_path': f'recordings/{index}.webm',
            'reference_path': 'reference/task-1.wav',
            'score': 60 + index,
            'source': 'teacher_review',
            'task_id': 'task-1',
            'reference_version': 1,
        }
        for index in range(1, 7)
    ]


def test_split_keeps_groups_isolated() -> None:
    splits = split_records(records_for_groups(), seed=42)
    group_splits = {}
    for split, records in splits.items():
        for record in records:
            group_splits.setdefault(record['group_id'], set()).add(split)
    assert all(len(split_names) == 1 for split_names in group_splits.values())
    assert all(splits[name] for name in ('train', 'validation', 'test'))


def test_manifest_rejects_invalid_score(tmp_path) -> None:
    record = records_for_groups()[0]
    record['score'] = 101
    manifest = tmp_path / 'manifest.jsonl'
    manifest.write_text(json.dumps(record) + '\n', encoding='utf-8')
    with pytest.raises(ValueError, match='score must be between 0 and 100'):
        load_records(manifest)


def test_split_metadata_records_reproducibility_inputs(tmp_path) -> None:
    write_splits(split_records(records_for_groups(), seed=42), tmp_path, dataset_version='approved-2026-09-22', seed=42)
    metadata = json.loads((tmp_path / 'split-metadata.json').read_text(encoding='utf-8'))
    assert metadata['dataset_version'] == 'approved-2026-09-22'
    assert metadata['split_seed'] == 42
    assert len(metadata['manifest_sha256']) == 64


def test_training_export_rejects_group_leakage(tmp_path) -> None:
    path = tmp_path / 'features.npz'
    np.savez(
        path,
        X=np.ones((3, 8), dtype=np.float32), y=np.array([60, 70, 80], dtype=np.float32),
        split=np.array(['train', 'validation', 'test']), group_id=np.array(['speaker-1', 'speaker-1', 'speaker-2']),
        feature_names=np.array(['embedding_cosine_similarity', 'text_similarity', 'duration_ratio', 'rms_similarity', 'zero_crossing_similarity', 'spectral_centroid_similarity', 'mel_mean_similarity', 'mel_std_similarity']),
    )
    with pytest.raises(ValueError, match='multiple splits'):
        load_export(path)


def test_metrics_include_teacher_correlation_mae_and_category_accuracy() -> None:
    result = metrics(np.array([55.0, 70.0, 90.0]), np.array([50.0, 74.0, 95.0]))
    assert result['mae'] == pytest.approx(4.6666667)
    assert result['pearson_correlation'] > 0.9
    assert result['category_accuracy'] == 1.0
