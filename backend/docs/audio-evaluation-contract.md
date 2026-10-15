# Errata SDD: Kontrak Audio dan Evaluasi

Status: **disepakati untuk implementasi Backend + MLP** pada 16 September 2026.
Dokumen ini menjadi sumber kebenaran bila SRS/SDD lama menyebut format upload
lain, konversi FFmpeg untuk rekaman Santri, atau antrean Redis/message broker.

## Keputusan alur audio

1. Frontend membuat dan mengunggah rekaman dalam format **WAV, PCM signed
   16-bit, 16 kHz, mono**, berdurasi **2--60 detik**, maksimum **10 MiB**.
2. Backend hanya memvalidasi file tersebut. Backend tidak mengonversi rekaman
   Santri dengan FFmpeg dan tidak memakai RabbitMQ, Redis, atau Kafka.
3. Antrean evaluasi adalah tabel PostgreSQL `evaluation_jobs`. Permintaan
   upload selesai setelah `audio_assets`, `attempts`, dan job awal tersimpan;
   evaluasi ML berjalan di worker terpisah.
4. Resample hanya boleh menjadi fallback terkontrol untuk **audio referensi
   historis** yang telah disetujui dan tercatat. Rekaman baru Santri tidak
   boleh di-resample sebagai jalan normal.
5. Frontend tidak membuat autosave rekaman atau endpoint draft. Rekaman hanya
   dikirim saat Santri secara eksplisit menekan submit.

## Kontrak Frontend--Backend

Base path backend adalah `/api/v1`; semua endpoint di bawah ini memerlukan
`Authorization: Bearer <access-token>`.

### Upload rekaman

`POST /api/v1/imitation/tasks/:taskId/submissions`

`Content-Type` harus `multipart/form-data` dengan tepat satu berkas pada field
`audio`. Nama/ekstensi tidak dipercaya; isi berkas harus WAV PCM signed
16-bit, 16 kHz, mono. Backend memvalidasi ukuran, keterbacaan/magic bytes,
durasi 2--60 detik, dan audio tidak sunyi sebelum membuat data atau mengunggah
objek.

Respons sukses adalah `201 Created` dan memiliki data berikut:

```json
{
  "submissionId": "uuid",
  "status": "SUBMITTED",
  "submittedAt": "2026-09-16T00:00:00.000Z"
}
```

Respons ini **bukan** hasil nilai. Frontend melakukan polling:

`GET /api/v1/imitation/submissions/:submissionId`

```json
{
  "submissionId": "uuid",
  "status": "SUBMITTED | PROCESSING | EVALUATED | FAILED",
  "score": null,
  "feedback": null,
  "errorCode": null,
  "submittedAt": "2026-09-16T00:00:00.000Z",
  "evaluatedAt": null,
  "failedAt": null
}
```

`score` dan `feedback` hanya terisi untuk `EVALUATED`; `FAILED` selalu
memiliki `score: null`. `409 IMITATION_ACTIVE_EXISTS` menandakan evaluasi
masih aktif; `429 IMITATION_COOLDOWN` menandakan jeda 10 detik belum berakhir.

## Kontrak Backend--ML service

### `POST /evaluate`

Backend mengirim `multipart/form-data` dengan:

- `submission_id`: UUID attempt.
- `reference`: satu WAV audio referensi snapshot.
- `recording`: satu WAV rekaman Santri.

Header `X-Request-Id` wajib dipropagasikan. Untuk pekerjaan worker yang tidak
berasal dari request HTTP aktif, backend menghasilkan UUID baru untuk setiap
pemanggilan ML dan mencatatnya di log aman. Timeout HTTP adalah 120 detik.

Respons sukses (`200`):

```json
{
  "submission_id": "uuid",
  "score": 0,
  "model_version": "yusro-mlp-v1.0.0",
  "whisper_version": "tiny",
  "processing_ms": 0,
  "details": {}
}
```

`score` harus numerik 0--100, `submission_id` harus sama dengan request, dan
`model_version`, `whisper_version`, serta `processing_ms` wajib valid. Backend
menentukan `feedback` dari score; ML tidak pernah mengembalikan kategori
feedback sebagai nilai resmi.

Respons gagal (`4xx`/`5xx`) berbentuk:

```json
{ "error_code": "AUDIO_DECODE_FAILED", "message": "Audio cannot be decoded" }
```

Mapping yang dibekukan:

| Kode | Retry worker |
| --- | --- |
| `ML_UNAVAILABLE`, `ML_TIMEOUT_HTTP`, `ML_SERVICE_ERROR` | Ya |
| `ML_BAD_REQUEST`, `ML_INVALID_RESPONSE`, `AUDIO_DECODE_FAILED` | Tidak |

### `GET /health`

- `200`: `{ "status": "ok", "model_version": "...", "model_loaded": true }`
- `503`: `{ "status": "loading", "model_version": "...", "model_loaded": false }`

### `GET /model-info`

`200` memuat `model_version`, `whisper_version`, `model_loaded`, daftar fitur
dalam urutan inferensi, `trained_at`, dan metrik ringkas artefak. Endpoint ini
tidak memuat audio, transkrip, atau data Santri.

## Konfirmasi eksternal yang masih diperlukan

Ibnu/Frontend perlu mengonfirmasi secara tertulis bahwa aplikasi klien:

1. selalu menghasilkan WAV sesuai kontrak sebelum upload;
2. melakukan polling endpoint submission sampai terminal; dan
3. tidak membuat autosave atau draft rekaman.

Status tiga butir tersebut adalah **menunggu konfirmasi tim frontend**; belum
dianggap selesai hanya karena kontraknya sudah ditulis.
