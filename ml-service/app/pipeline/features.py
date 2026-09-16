import numpy as np
import librosa
from difflib import SequenceMatcher


COMPARISON_FEATURE_NAMES = (
	'embedding_cosine_similarity', 'text_similarity', 'duration_ratio', 'rms_similarity',
	'zero_crossing_similarity', 'spectral_centroid_similarity', 'mel_mean_similarity', 'mel_std_similarity',
)


def extract_acoustic_features(samples: np.ndarray, sample_rate: int) -> dict[str, float]:
	duration = float(len(samples) / sample_rate)
	rms = float(np.sqrt(np.mean(np.square(samples))))
	zero_crossing_rate = float(np.mean(librosa.feature.zero_crossing_rate(y=samples)))
	spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=samples, sr=sample_rate)))
	mel = librosa.feature.melspectrogram(y=samples, sr=sample_rate, n_mels=40)
	mel_db = librosa.power_to_db(mel, ref=np.max)
	return {
		'duration_seconds': duration, 'rms': rms, 'zero_crossing_rate': zero_crossing_rate,
		'spectral_centroid_hz': spectral_centroid, 'mel_mean_db': float(np.mean(mel_db)), 'mel_std_db': float(np.std(mel_db)),
	}


def _similarity(left: float, right: float) -> float:
	return float(np.clip(1.0 - abs(left - right) / max(abs(left), abs(right), 1e-6), 0.0, 1.0))


def comparison_features(reference: dict[str, float], recording: dict[str, float], reference_embedding: np.ndarray, recording_embedding: np.ndarray, reference_text: str, recording_text: str) -> dict[str, float]:
	denominator = max(float(np.linalg.norm(reference_embedding) * np.linalg.norm(recording_embedding)), 1e-6)
	cosine = float(np.clip(np.dot(reference_embedding, recording_embedding) / denominator, -1.0, 1.0))
	return {
		'embedding_cosine_similarity': (cosine + 1.0) / 2.0,
		'text_similarity': SequenceMatcher(None, reference_text.strip().lower(), recording_text.strip().lower()).ratio(),
		'duration_ratio': float(np.clip(recording['duration_seconds'] / max(reference['duration_seconds'], 1e-6), 0.0, 1.0)),
		'rms_similarity': _similarity(reference['rms'], recording['rms']),
		'zero_crossing_similarity': _similarity(reference['zero_crossing_rate'], recording['zero_crossing_rate']),
		'spectral_centroid_similarity': _similarity(reference['spectral_centroid_hz'], recording['spectral_centroid_hz']),
		'mel_mean_similarity': _similarity(reference['mel_mean_db'], recording['mel_mean_db']),
		'mel_std_similarity': _similarity(reference['mel_std_db'], recording['mel_std_db']),
	}
