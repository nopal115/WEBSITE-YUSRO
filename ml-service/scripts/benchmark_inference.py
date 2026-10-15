"""Measure /evaluate latency for approved WAV pairs at 2, 10, 30, and 60 seconds."""

from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path

import httpx


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round((len(ordered) - 1) * fraction)))
    return ordered[index]


def benchmark(url: str, reference: Path, recordings: dict[int, Path], runs: int) -> dict[str, dict[str, float]]:
    results: dict[str, dict[str, float]] = {}
    with httpx.Client(timeout=120) as client:
        for seconds, recording in recordings.items():
            values: list[float] = []
            for index in range(runs):
                started = time.perf_counter()
                with reference.open('rb') as reference_file, recording.open('rb') as recording_file:
                    response = client.post(
                        f'{url.rstrip("/")}/evaluate',
                        data={'submission_id': f'benchmark-{seconds}-{index}'},
                        files={'reference': ('reference.wav', reference_file, 'audio/wav'), 'recording': (recording.name, recording_file, 'audio/wav')},
                    )
                response.raise_for_status()
                values.append((time.perf_counter() - started) * 1000)
            results[str(seconds)] = {'runs': runs, 'p50_ms': round(statistics.median(values), 2), 'p95_ms': round(percentile(values, 0.95), 2)}
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--reference', type=Path, required=True)
    parser.add_argument('--recording-2', type=Path, required=True)
    parser.add_argument('--recording-10', type=Path, required=True)
    parser.add_argument('--recording-30', type=Path, required=True)
    parser.add_argument('--recording-60', type=Path, required=True)
    parser.add_argument('--runs', type=int, default=5)
    args = parser.parse_args()
    if args.runs < 1:
        raise ValueError('--runs must be positive')
    print(json.dumps(benchmark(args.url, args.reference, {2: args.recording_2, 10: args.recording_10, 30: args.recording_30, 60: args.recording_60}, args.runs), indent=2, sort_keys=True))


if __name__ == '__main__':
    main()
