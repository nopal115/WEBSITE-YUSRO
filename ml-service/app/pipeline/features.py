import numpy as np
import librosa


def extract_features(samples: np.ndarray, sample_rate: int) -> dict[str, float]:
	duration = float(len(samples) / sample_rate)
	rms = float(np.sqrt(np.mean(np.square(samples))))
	zero_crossing_rate = float(np.mean(librosa.feature.zero_crossing_rate(y=samples)))
	spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=samples, sr=sample_rate)))
	mel = librosa.feature.melspectrogram(y=samples, sr=sample_rate, n_mels=40)
	mel_db = librosa.power_to_db(mel, ref=np.max)
	return {
		'duration_seconds': round(duration, 3),
		'rms': round(rms, 6),
		'zero_crossing_rate': round(zero_crossing_rate, 6),
		'spectral_centroid_hz': round(spectral_centroid, 3),
		'mel_mean_db': round(float(np.mean(mel_db)), 3),
		'mel_std_db': round(float(np.std(mel_db)), 3),
	}
