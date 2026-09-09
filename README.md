# Web Pembelajaran Al-Qur'an Metode Yusro

Monorepo dengan tiga service:
- Frontend: Vite, port 5173
- Backend API: NestJS, port 3000
- ML service: FastAPI, port 8000

Mode dev:
- `cd frontend && npm run dev`
- `cd backend && npm run start:dev`
- `cd ml-service && uvicorn app.main:app --reload --port 8000`

Role sistem hanya SANTRI dan ADMIN_PENGAJAR, evaluasi bersifat otomatis via ML - lihat SRS Bab 7.6.
