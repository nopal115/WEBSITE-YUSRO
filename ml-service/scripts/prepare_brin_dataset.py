"""Generate comparison feature export (.npz) from BRIN audio dataset using Whisper Tiny and acoustic features."""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import librosa
import soundfile as sf
import torch

from app.pipeline.features import (
    COMPARISON_FEATURE_NAMES,
    comparison_features,
    extract_acoustic_features,
    vectorize_comparison_features,
)
from app.pipeline.whisper_encoder import encode_audio, load_whisper_model, transcribe_audio


def perturb_audio(samples: np.ndarray, sr: int, mode: str, rng: random.Random) -> np.ndarray:
    """Create controlled acoustic variations to simulate student attempts."""
    out = samples.copy()
    if mode == 'identical':
        # Exact with slight volume jitter
        gain = 10.0 ** (rng.uniform(-0.5, 0.5) / 20.0)
        out = np.clip(out * gain, -1.0, 1.0)
    elif mode == 'minor_variation':
        # Slight speed variation via resampling
        rate = rng.choice([0.95, 1.05])
        out = librosa.resample(out, orig_sr=sr, target_sr=int(sr * rate))
        # Very light noise
        noise = np.random.normal(0, 0.003, size=len(out)).astype(np.float32)
        out = np.clip(out + noise, -1.0, 1.0)
    elif mode == 'moderate_variation':
        # Moderate speed change and moderate background noise
        rate = rng.choice([0.88, 1.12])
        out = librosa.resample(out, orig_sr=sr, target_sr=int(sr * rate))
        noise = np.random.normal(0, 0.010, size=len(out)).astype(np.float32)
        out = np.clip(out + noise, -1.0, 1.0)
    elif mode == 'severe_variation':
        # Noticeable distortion, heavier tempo change and noise
        rate = rng.choice([0.78, 1.25])
        out = librosa.resample(out, orig_sr=sr, target_sr=int(sr * rate))
        # Light low-pass filter smoothing + heavy noise
        out = np.convolve(out, [0.25, 0.5, 0.25], mode='same').astype(np.float32)
        noise = np.random.normal(0, 0.035, size=len(out)).astype(np.float32)
        out = np.clip(out + noise, -1.0, 1.0)

    # Ensure minimum length of 1.2 seconds for feature extraction
    min_len = int(sr * 1.2)
    if len(out) < min_len:
        padding = np.zeros(min_len - len(out), dtype=np.float32)
        out = np.concatenate([out, padding])

    return out.astype(np.float32)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio-dir', type=Path, default=Path('dataset/REKAMAN BRIN'))
    parser.add_argument('--output', type=Path, default=Path('dataset/features_export.npz'))
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    print('Pre-loading Whisper Tiny...')
    load_whisper_model()

    print(f'Discovering audio files in {args.audio_dir}...')
    audio_files = sorted(list(args.audio_dir.glob('**/*.mp3')))
    if not audio_files:
        raise ValueError(f'No audio files found in {args.audio_dir}')
    print(f'Found {len(audio_files)} audio files.')

    # Preload and convert all audio files to 16kHz mono
    print('Loading and preprocessing base audio files to 16kHz mono...')
    base_audios: dict[str, np.ndarray] = {}
    sr = 16000
    for p in audio_files:
        stem = p.stem
        samples, _ = librosa.load(str(p), sr=sr, mono=True)
        # Ensure at least 1.5 seconds length
        if len(samples) < int(sr * 1.5):
            padding = np.zeros(int(sr * 1.5) - len(samples), dtype=np.float32)
            samples = np.concatenate([samples, padding])
        base_audios[stem] = samples.astype(np.float32)

    stems = sorted(list(base_audios.keys()))
    rng.shuffle(stems)

    # Group splitting: 70% train, 15% validation, 15% test
    n_train = int(len(stems) * 0.70)
    n_val = int(len(stems) * 0.15)
    train_groups = set(stems[:n_train])
    val_groups = set(stems[n_train:n_train + n_val])
    test_groups = set(stems[n_train + n_val:])

    print(f'Splits: {len(train_groups)} train, {len(val_groups)} val, {len(test_groups)} test groups.')

    X_list: list[np.ndarray] = []
    y_list: list[float] = []
    split_list: list[str] = []
    group_list: list[str] = []

    print('Extracting features for all pairs...')
    total = len(stems)
    for idx, stem in enumerate(stems, 1):
        if idx % 20 == 0 or idx == total:
            print(f'Processing {idx}/{total} audio files...')

        ref_samples = base_audios[stem]
        ref_acoustic = extract_acoustic_features(ref_samples, sr)
        ref_embed = encode_audio(ref_samples)
        ref_text = transcribe_audio(ref_samples)

        if stem in train_groups:
            split_name = 'train'
        elif stem in val_groups:
            split_name = 'validation'
        else:
            split_name = 'test'

        # Pair 1: Identical / Pristine (Score 95 - 100)
        rec_1 = perturb_audio(ref_samples, sr, 'identical', rng)
        rec_1_ac = extract_acoustic_features(rec_1, sr)
        rec_1_emb = encode_audio(rec_1)
        rec_1_txt = transcribe_audio(rec_1)
        score_1 = rng.uniform(94.0, 99.5)
        f_1 = comparison_features(ref_acoustic, rec_1_ac, ref_embed, rec_1_emb, ref_text, rec_1_txt)
        X_list.append(vectorize_comparison_features(f_1))
        y_list.append(score_1)
        split_list.append(split_name)
        group_list.append(stem)

        # Pair 2: Minor variation (Score 82 - 91)
        rec_2 = perturb_audio(ref_samples, sr, 'minor_variation', rng)
        rec_2_ac = extract_acoustic_features(rec_2, sr)
        rec_2_emb = encode_audio(rec_2)
        rec_2_txt = transcribe_audio(rec_2)
        score_2 = rng.uniform(81.0, 90.0)
        f_2 = comparison_features(ref_acoustic, rec_2_ac, ref_embed, rec_2_emb, ref_text, rec_2_txt)
        X_list.append(vectorize_comparison_features(f_2))
        y_list.append(score_2)
        split_list.append(split_name)
        group_list.append(stem)

        # Pair 3: Moderate variation (Score 70 - 79)
        rec_3 = perturb_audio(ref_samples, sr, 'moderate_variation', rng)
        rec_3_ac = extract_acoustic_features(rec_3, sr)
        rec_3_emb = encode_audio(rec_3)
        rec_3_txt = transcribe_audio(rec_3)
        score_3 = rng.uniform(70.0, 79.0)
        f_3 = comparison_features(ref_acoustic, rec_3_ac, ref_embed, rec_3_emb, ref_text, rec_3_txt)
        X_list.append(vectorize_comparison_features(f_3))
        y_list.append(score_3)
        split_list.append(split_name)
        group_list.append(stem)

        # Pair 4: Severe distortion (Score 45 - 65)
        rec_4 = perturb_audio(ref_samples, sr, 'severe_variation', rng)
        rec_4_ac = extract_acoustic_features(rec_4, sr)
        rec_4_emb = encode_audio(rec_4)
        rec_4_txt = transcribe_audio(rec_4)
        score_4 = rng.uniform(45.0, 64.0)
        f_4 = comparison_features(ref_acoustic, rec_4_ac, ref_embed, rec_4_emb, ref_text, rec_4_txt)
        X_list.append(vectorize_comparison_features(f_4))
        y_list.append(score_4)
        split_list.append(split_name)
        group_list.append(stem)

        # Pair 5: Completely different letter/word (Score 20 - 45)
        diff_stem = rng.choice([s for s in stems if s != stem])
        rec_5 = base_audios[diff_stem]
        rec_5_ac = extract_acoustic_features(rec_5, sr)
        rec_5_emb = encode_audio(rec_5)
        rec_5_txt = transcribe_audio(rec_5)
        score_5 = rng.uniform(20.0, 44.0)
        f_5 = comparison_features(ref_acoustic, rec_5_ac, ref_embed, rec_5_emb, ref_text, rec_5_txt)
        X_list.append(vectorize_comparison_features(f_5))
        y_list.append(score_5)
        split_list.append(split_name)
        group_list.append(stem)

    X = np.asarray(X_list, dtype=np.float32)
    y = np.asarray(y_list, dtype=np.float32)
    split = np.asarray(split_list, dtype=str)
    group_id = np.asarray(group_list, dtype=str)
    feature_names = np.asarray(COMPARISON_FEATURE_NAMES, dtype=str)

    print(f'Total samples: {len(X)}')
    print(f'Feature dimensions: {X.shape}')
    print(f'Scores: min={y.min():.2f}, mean={y.mean():.2f}, max={y.max():.2f}')

    args.output.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        args.output,
        X=X,
        y=y,
        split=split,
        group_id=group_id,
        feature_names=feature_names,
    )
    print(f'Feature export saved successfully to {args.output}')


if __name__ == '__main__':
    main()
