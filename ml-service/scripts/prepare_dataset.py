"""Validate and split the ML manifest by anonymized group_id."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from pathlib import Path
from typing import Any

REQUIRED_FIELDS = {
    'id',
    'group_id',
    'recording_path',
    'reference_path',
    'score',
    'source',
    'task_id',
    'reference_version',
}
SPLIT_NAMES = ('train', 'validation', 'test')


def load_records(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for line_number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f'{path}:{line_number}: invalid JSON: {error}') from error
        missing = REQUIRED_FIELDS - record.keys()
        if missing:
            raise ValueError(f'{path}:{line_number}: missing fields: {sorted(missing)}')
        if record['id'] in seen_ids:
            raise ValueError(f'{path}:{line_number}: duplicate id {record["id"]}')
        if not isinstance(record['score'], (int, float)) or not 0 <= record['score'] <= 100:
            raise ValueError(f'{path}:{line_number}: score must be between 0 and 100')
        if not record['group_id'] or not record['recording_path'] or not record['reference_path']:
            raise ValueError(f'{path}:{line_number}: group and audio paths cannot be empty')
        for field in ('recording_path', 'reference_path'):
            candidate = Path(record[field])
            if candidate.is_absolute() or '..' in candidate.parts:
                raise ValueError(f'{path}:{line_number}: {field} must stay inside the approved dataset directory')
        seen_ids.add(record['id'])
        records.append(record)
    if not records:
        raise ValueError(f'{path}: manifest is empty')
    return records


def split_records(records: list[dict[str, Any]], seed: int) -> dict[str, list[dict[str, Any]]]:
    groups = sorted({record['group_id'] for record in records})
    if len(groups) < 3:
        raise ValueError('at least 3 distinct group_id values are required for three splits')
    random.Random(seed).shuffle(groups)
    train_count = max(1, round(len(groups) * 0.70))
    validation_count = max(1, round(len(groups) * 0.15))
    if train_count + validation_count >= len(groups):
        validation_count = 1
        train_count = len(groups) - 2
    train_groups = set(groups[:train_count])
    validation_groups = set(groups[train_count:train_count + validation_count])
    result = {name: [] for name in SPLIT_NAMES}
    for record in records:
        if record['group_id'] in train_groups:
            split = 'train'
        elif record['group_id'] in validation_groups:
            split = 'validation'
        else:
            split = 'test'
        result[split].append({**record, 'split': split})
    return result


def write_splits(splits: dict[str, list[dict[str, Any]]], output: Path, *, dataset_version: str, seed: int) -> None:
    output.mkdir(parents=True, exist_ok=True)
    for name, records in splits.items():
        destination = output / f'{name}.jsonl'
        content = ''.join(json.dumps(record, sort_keys=True) + '\n' for record in records)
        destination.write_text(content, encoding='utf-8')
    combined = ''.join(
        json.dumps(record, sort_keys=True) + '\n'
        for name in SPLIT_NAMES
        for record in splits[name]
    )
    metadata = {
        'dataset_version': dataset_version,
        'split_seed': seed,
        'split_strategy': 'group_id:70/15/15',
        'record_count': sum(len(records) for records in splits.values()),
        'group_count': len({record['group_id'] for records in splits.values() for record in records}),
        'manifest_sha256': hashlib.sha256(combined.encode('utf-8')).hexdigest(),
        'splits': {name: len(records) for name, records in splits.items()},
    }
    (output / 'split-metadata.json').write_text(json.dumps(metadata, indent=2, sort_keys=True) + '\n', encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--dataset-version', required=True)
    args = parser.parse_args()
    splits = split_records(load_records(args.input), args.seed)
    write_splits(splits, args.output, dataset_version=args.dataset_version, seed=args.seed)
    print({name: len(records) for name, records in splits.items()})


if __name__ == '__main__':
    main()
