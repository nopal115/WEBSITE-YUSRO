"""Generate isolated WAV upload fixtures for the backend API test stages."""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path


OUTPUT = Path(__file__).parent / "fixtures" / "audio-generated"
RATE = 16_000


def pcm_frames(seconds: int, silent: bool = False) -> bytes:
    count = seconds * RATE
    if silent:
        return b"\0\0" * count
    return b"".join(
        struct.pack("<h", int(10_000 * math.sin(2 * math.pi * 440 * i / RATE)))
        for i in range(count)
    )


def write_wav(path: Path, seconds: int, silent: bool = False) -> None:
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(pcm_frames(seconds, silent))


def wav_chunk(name: bytes, payload: bytes) -> bytes:
    return name + struct.pack("<I", len(payload)) + payload + (b"\0" if len(payload) % 2 else b"")


def write_oversize_valid_wav(path: Path) -> None:
    """Add a legal RIFF JUNK chunk so duration stays valid while size exceeds 10 MiB."""
    fmt = struct.pack("<HHIIHH", 1, 1, RATE, RATE * 2, 2, 16)
    padding = b"\0" * (10 * 1024 * 1024 + 1)
    body = wav_chunk(b"fmt ", fmt) + wav_chunk(b"JUNK", padding) + wav_chunk(b"data", pcm_frames(3))
    path.write_bytes(b"RIFF" + struct.pack("<I", len(body) + 4) + b"WAVE" + body)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    write_wav(OUTPUT / "valid.wav", 3)
    write_wav(OUTPUT / "silent.wav", 3, silent=True)
    write_wav(OUTPUT / "too-short.wav", 1)
    write_wav(OUTPUT / "too-long.wav", 61)
    write_oversize_valid_wav(OUTPUT / "too-large.wav")
    (OUTPUT / "wrong-format.txt").write_text("This is not an audio file.\n", encoding="utf-8")
    print(f"Generated audio upload fixtures in {OUTPUT}")


if __name__ == "__main__":
    main()
