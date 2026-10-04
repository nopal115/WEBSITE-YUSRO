# Aturan Kerja Frontend Yusro

## Peran dan batas
- Bagas: frontend dan SDD. Noval: backend, ml-service, database, dan SRS.
- Hanya ubah file di dalam frontend/. Folder backend/, ml-service/, dan file
  di root repo hanya boleh DIBACA.
- Tujuan akhir: frontend mudah digabungkan dengan backend Noval.

## Cara kerja
- Tampilkan RENCANA dulu dan tunggu persetujuan sebelum mengubah file.
- Jangan mengambil keputusan sendiri. Konflik atau hal yang tidak diatur
  dokumen → berhenti dan tanya.
- Jangan menambah fitur, file, komponen, atau dependency di luar tugas.
  Kalau perlu, ajukan sebagai usulan.
- Commit kecil per langkah dengan pesan jelas. JANGAN push. Jangan
  menjalankan perintah git yang merusak (reset --hard, rebase, push --force,
  hapus branch) tanpa izin.
- Pakai label [FAKTA], [ASUMSI], [TBD], [REKOMENDASI] di laporan dan komentar.
- Laporan akhir: commit, file yang diubah, hasil verifikasi, temuan. Lalu
  BERHENTI.

## Acuan dokumen
- SDD: ../../SDD.md (versi terbaru). SRS: ../../SRS.md. Keduanya di luar repo;
  jangan salin isi atau berkasnya ke dalam repo.
- Urutan acuan: SDD dulu; Figma kalau SDD tidak mengatur. Kalau SDD
  bertentangan dengan dirinya sendiri, SRS yang berlaku (Ketentuan Penggunaan
  Dokumen SDD).
- Setiap penyimpangan dari SDD yang sudah disetujui diberi komentar di kode.

## Integrasi dengan backend (agar mudah di-merge)
- Semua pengetahuan tentang bentuk respons backend hanya ada di
  src/lib/api/responseFormat.ts.
- Pemanggilan endpoint per fitur hanya di src/features/<fitur>/api.ts,
  mengikuti kontrak SDD Bab 5.
- Data tiruan dinyalakan dengan VITE_USE_MOCK=true dan tidak boleh ikut ke
  build produksi.
- Detail kontrak yang tidak dijelaskan SDD ditandai [ASUMSI] di tipe/kode.

## Desain dan aksesibilitas
- Warna, tipografi, radius, dan bayangan hanya lewat token SDD 7.2–7.4;
  tanpa kode warna langsung di komponen.
- Jarak (padding, margin, gap) hanya dari skala SDD 7.2.2; pengecualian
  diberi komentar.
- SDD 7.11: kontras teks minimal 4,5:1, semua kontrol bisa dipakai dengan
  keyboard, area sentuh minimal 44×44px.
- Semua teks antarmuka memakai "Anda".

## Keputusan yang sudah final
- Audio rekaman mengikuti SRS FR-IMITATE-06: WebM/Opus dengan cadangan MP4,
  1–30 detik, maksimal 5 MB, diunggah dalam format asli tanpa konversi WAV.
  Batasan selalu dibaca dari objek constraints API, tidak ditulis di kode.
- Dengar-Tirukan: satu rekaman per tugas, cara merekam tekan-dan-tahan
  (dengan versi keyboard).
- Dengar-Pilih: semua jawaban dikirim sekaligus; hasil dan kunci jawaban
  hanya tampil setelah dikirim.
- Route mengikuti sitemap SDD 12.5.
- Sapaan Dashboard "Assalamu'alaikum, [nama]" (menyimpang dari SDD 7.7.4).
- Tombol logout belum ditambahkan; menunggu desain.

## Verifikasi standar
tsc --noEmit, npm run lint, npx vitest run, dan npm run build harus lolos.
Uji di mode mock pada lebar 375 dan 1440.
