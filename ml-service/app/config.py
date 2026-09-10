from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
	max_audio_bytes: int = int(os.getenv('MAX_AUDIO_BYTES', str(25 * 1024 * 1024)))
	min_audio_seconds: float = float(os.getenv('MIN_AUDIO_SECONDS', '0.1'))
	max_audio_seconds: float = float(os.getenv('MAX_AUDIO_SECONDS', '120'))
	whisper_model: str = os.getenv('WHISPER_MODEL', 'tiny')
	mlp_checkpoint: str = os.getenv('MLP_CHECKPOINT', 'models/mlp.pt')


settings = Settings()
