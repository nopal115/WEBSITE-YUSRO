# Cara menyalakan backend Noval lagi (lokal)

Yang sudah siap dan tidak perlu diulang:
- Worktree backend: `C:\Users\pc\OneDrive\Desktop\alquran\yusro-backend` (detached di `origin/main`, terakhir `173c15a`; backend-nya identik dengan `423918c`).
- `backend\.env` sudah terisi, termasuk `STORAGE_DRIVER=local` sehingga MinIO tidak diperlukan.
- Database `yusro` di PostgreSQL 16 sudah dimigrasi dan diisi seed backend: kurikulum 10 tahapan, 69 materi, 79 tugas, 138 audio, dan akun `admin@yusro.local`. Untuk uji ada juga akun santri `santri.uji@yusro.local`.

## 1. Pastikan PostgreSQL jalan
Layanan `postgresql-x64-16` biasanya menyala otomatis saat Windows start. Untuk mengecek, buka `services.msc` dan pastikan statusnya **Running**. Kalau belum, klik kanan lalu pilih **Start**.

## 2. Nyalakan backend (terminal 1)
```
cd C:\Users\pc\OneDrive\Desktop\alquran\yusro-backend\backend
npm run start:dev
```
Backend siap kalau muncul tulisan `Nest application successfully started`. Membuka http://localhost:3000/api/v1 akan menampilkan `Unauthorized`; itu normal dan artinya server hidup.

Kalau Noval sudah mengirim update ke `main`, ambil dulu kodenya sebelum menyalakan backend:
```
cd C:\Users\pc\OneDrive\Desktop\alquran\yusro-backend
git fetch origin
git checkout --detach origin/main
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
```
Worktree ini memakai `--detach` karena branch `main` sudah dipakai folder `WEBSITE-YUSRO`. Jalankan `npx prisma db seed` hanya bila ingin mengisi ulang data contoh.

## 3. Arahkan frontend ke backend
Ubah `WEBSITE-YUSRO\frontend\.env`:
```
VITE_API_BASE_URL=/api/v1
VITE_USE_MOCK=false
```

## 4. Nyalakan frontend (terminal 2)
```
cd C:\Users\pc\OneDrive\Desktop\alquran\WEBSITE-YUSRO\frontend
npm run dev
```
Lalu buka http://localhost:5173. Proxy Vite meneruskan `/api` ke `localhost:3000`, jadi tidak perlu CORS. Sejak backend `423918c`, login Santri dan Admin dari frontend sudah berjalan (`GET auth/me` tersedia).

## 5. Kembali ke mode mock
Ubah `VITE_USE_MOCK=true` di `frontend\.env`. Server dev akan restart sendiri. Login mock: `admin@yusro.mock` / `admin1234` atau `santri@yusro.mock` / `santri123`.

## Catatan
- Untuk mematikan backend atau frontend, tekan Ctrl+C di terminalnya. Pastikan hanya ada satu server dev frontend; server kedua akan pindah ke port 5174.
- Worktree backend berada di dalam OneDrive, bersebelahan dengan `WEBSITE-YUSRO` dan folder `catatan`. Kalau `npm ci` gagal dengan EPERM saat menghapus berkas di `node_modules`, jeda sinkronisasi OneDrive dulu lalu ulangi.
- Jangan jalankan `npm ci` di folder frontend selagi server dev menyala: Vite mengunci `esbuild.exe` dan instalasi gagal setengah jalan.
- Endpoint yang masih belum ada atau berbeda bentuk dicatat di `api-contract.md` (bagian 1.9) dan SDD v1.1 Bab 5.25.
- Password database dan admin tersimpan di `C:\Users\pc\OneDrive\Desktop\alquran\yusro-backend\backend\.env`. File ini tidak ter-commit dan jangan dibagikan.
