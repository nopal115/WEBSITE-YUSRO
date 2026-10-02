-- Historical references may be explicitly approved for a controlled 16 kHz
-- resample. New assets, especially Santri recordings, remain strict by default.
ALTER TABLE "AudioAsset"
  ADD COLUMN "allowLegacyResample" BOOLEAN NOT NULL DEFAULT false;
