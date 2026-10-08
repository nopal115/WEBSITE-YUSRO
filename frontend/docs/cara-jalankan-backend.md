# Cara menyalakan backend Noval lagi (lokal)

Yang sudah siap dan tidak perlu diulang:
- Worktree backend: `C:\dev\yusro-backend` (branch `integration/nocal-bagas`, detached).
- `backend\.env` sudah terisi.
- Database `yusro` di PostgreSQL 16 sudah dimigrasi dan berisi akun `admin@yusro.local`.

## 1. Pastikan PostgreSQL jalan
Layanan `postgresql-x64-16` biasanya menyala otomatis saat Windows start. Untuk mengecek, buka `services.msc` dan pastikan statusnya **Running**. Kalau belum, klik kanan lalu pilih **Start**.

## 2. Nyalakan backend (terminal 1)
```
cd C:\dev\yusro-backend\backend
npm run start:dev
```
Backend siap kalau muncul tulisan `Nest application successfully started`. Membuka http://localhost:3000/api/v1 akan menampilkan `Unauthorized`; itu normal dan artinya server hidup.

Kalau Noval sudah mengirim update, ambil dulu kodenya sebelum menyalakan backend:
```
cd C:\dev\yusro-backend
git fetch origin
git checkout --detach origin/integration/nocal-bagas
cd backend
npm ci
npx prisma migrate deploy
```
Kalau `npm ci` melewati install script, jalankan juga `npx prisma generate`.

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
Lalu buka http://localhost:5173. Proxy Vite meneruskan `/api` ke `localhost:3000`, jadi tidak perlu CORS.

## 5. Kembali ke mode mock
Ubah `VITE_USE_MOCK=true` di `frontend\.env`. Server dev akan restart sendiri. Login mock: `admin@yusro.mock` / `admin1234` atau `santri@yusro.mock` / `santri123`.

## Catatan
- Untuk mematikan backend atau frontend, tekan Ctrl+C di terminalnya.
- Login ke backend asli baru akan berhasil setelah Noval menambahkan `GET auth/me`.
- Password database dan admin tersimpan di `C:\dev\yusro-backend\backend\.env`. File ini tidak ter-commit dan jangan dibagikan.
