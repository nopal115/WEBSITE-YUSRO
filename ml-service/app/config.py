from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
	max_audio_bytes: int = int(os.getenv('MAX_AUDIO_BYTES', str(10 * 1024 * 1024)))
	min_audio_seconds: float = float(os.getenv('MIN_AUDIO_SECONDS', '2'))
	max_audio_seconds: float = float(os.getenv('MAX_AUDIO_SECONDS', '60'))
	min_trimmed_audio_seconds: float = float(os.getenv('MIN_TRIMMED_AUDIO_SECONDS', '1'))
	whisper_model: str = os.getenv('WHISPER_MODEL', 'tiny')
	mlp_checkpoint: str = os.getenv('MLP_CHECKPOINT', 'models/mlp.pt')
	model_version: str = os.getenv('MODEL_VERSION', 'yusro-mlp-v0.0.0')


settings = Settings()
