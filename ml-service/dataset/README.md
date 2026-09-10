# Dataset Machine Learning

Dataset ML dipisahkan dari audio produksi aplikasi. Folder ini hanya berisi salinan atau referensi data yang memang disetujui untuk training, validation, dan testing.

## Struktur

```text
dataset/
  reference/       # audio referensi pembanding, bukan audio produksi aktif
  recordings/      # rekaman santri yang dianonimkan dan sudah disetujui
  manifest.jsonl   # satu metadata record per baris
  splits/          # manifest hasil pembagian otomatis
```

Audio produksi tetap disimpan di object storage aplikasi dan tidak boleh dibaca langsung oleh script training.

## Format manifest

Setiap baris `manifest.jsonl` adalah satu pasangan audio dengan format:

```json
{"id":"sample-0001","group_id":"student-001","recording_path":"recordings/sample-0001.webm","reference_path":"reference/task-001-v1.wav","score":85.0,"source":"teacher_review","task_id":"task-001","reference_version":1}
```

Aturan:

- `id` unik untuk setiap sample.
- `group_id` adalah ID anonim santri atau sumber rekaman. Nilai ini dipakai untuk mencegah data dari satu santri masuk ke split berbeda.
- `recording_path` wajib menunjuk audio rekaman santri yang sudah disetujui.
- `reference_path` wajib menunjuk audio referensi historis yang digunakan saat rekaman dibuat.
- `score` adalah label numerik dari 0 sampai 100, diberikan melalui review pengajar atau anotasi yang disetujui.
- `source` wajib menjelaskan asal label, misalnya `teacher_review`.
- `task_id` dan `reference_version` menjaga keterlacakan data historis.
- Jangan menyimpan nama, email, atau data pribadi santri di manifest.

## Pembagian data

Jalankan dari folder `ml-service`:

```powershell
.\.venv\Scripts\python.exe scripts\prepare_dataset.py --input dataset\manifest.jsonl --output dataset\splits
```

Default split adalah `70% train`, `15% validation`, dan `15% test`, menggunakan seed `42`. Pembagian dilakukan berdasarkan `group_id`, bukan baris individual, sehingga rekaman santri yang sama tidak bocor antar split.

Script hanya membuat manifest split; file audio tidak disalin atau dimodifikasi.
