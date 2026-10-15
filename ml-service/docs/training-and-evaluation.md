# Training dan evaluasi MLP

Dataset training hanya boleh berasal dari ekspor offline yang disetujui Pengajar
dan pemilik data. Ia disimpan pada bucket/proyek terpisah, dengan kredensial
khusus training yang tidak tersedia pada service aplikasi produksi. `dataset/`
di repository hanya menyimpan manifest contoh, bukan rekaman produksi.

## Rubrik anotasi Pengajar

Pengajar memberi nilai 0--100 setelah mendengar pasangan reference dan
recording: ketepatan makhraj/tajwid 45%, kelancaran dan urutan lafaz 30%, serta
ritme/durasi 25%. Nilai akhir adalah jumlah berbobot; anotator mencatat versi
rubrik dan reference. Kategori evaluasi: `NEEDS_PRACTICE` (<60), `DEVELOPING`
(60--79.99), `GOOD` (>=80). Kategori ini dipakai hanya untuk metrik; backend
tetap menjadi pemilik kategori feedback produksi.

## Prosedur reproducible

1. Validasi manifest approved lalu buat split dengan `group_id`, seed, dan
   `dataset_version` yang eksplisit. Metadata hash disimpan di
   `split-metadata.json`.
2. Ekspor fitur final dengan urutan `COMPARISON_FEATURE_NAMES`; ekspor wajib
   menyertakan `group_id` dan split. Jangan menambah rekaman Santri otomatis.
3. Jalankan `scripts/train_mlp.py`. Checkpoint menyimpan konfigurasi, seed,
   dataset version, feature order, arsitektur/scaler, dan metrik test.

Sebelum rilis, catat korelasi Pearson, MAE, dan ketepatan kategori pada split
test. Jalankan pula suite input rusak/hening/berisik, durasi 2/60 detik dan
konsistensi deterministik. Benchmark `/evaluate` dengan pasangan WAV 2, 10,
30, dan 60 detik di lingkungan target; simpan p50/p95 latency dan commit
laporannya bersama `experiment_id`. Gunakan
`scripts/benchmark_inference.py --url <ML_URL> --reference <WAV> --recording-2
<WAV> --recording-10 <WAV> --recording-30 <WAV> --recording-60 <WAV>`.
