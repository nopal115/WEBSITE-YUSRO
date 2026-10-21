# Web Pembelajaran Al-Qur'an Metode Yusro

Monorepo dengan tiga service:
- Runtime Node.js: 22.x
- Frontend: Vite, port 5173
- Backend API: NestJS, port 3000
- ML service: FastAPI, port 8000

Mode dev:
- Backend: jalankan `docker compose -f docker-compose.dev.yml up -d db` dari folder utama, salin `backend/.env.example` ke `backend/.env`, lalu jalankan `npm ci`, `npm run db:migrate`, dan `npm run start:dev` dari folder `backend`.
- Frontend: `cd frontend && npm run dev`
- Backend API: `cd backend && npm run start:dev`
- `cd ml-service && uvicorn app.main:app --reload --port 8000`

Database development menggunakan kredensial lokal di atas dan tidak untuk production. Untuk mengisi akun Admin, atur `SEED_ADMIN_PASSWORD` lalu jalankan `npm run db:seed` dari folder `backend`.

Role sistem hanya SANTRI dan ADMIN_PENGAJAR. Evaluasi Dengar-Tirukan dirancang otomatis via ML (SRS Bab 7.6, BR-ML-01). Implementasi saat ini juga menyediakan penilaian manual oleh Admin/Pengajar; fitur ini berstatus [TBD], menunggu konfirmasi pembimbing dan revisi SRS (SDD v1.1 Bab 12.12).
