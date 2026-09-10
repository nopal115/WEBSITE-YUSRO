import json

import pytest

from scripts.prepare_dataset import load_records, split_records


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
