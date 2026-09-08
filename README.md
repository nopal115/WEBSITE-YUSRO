# Web Pembelajaran Al-Qur'an Metode Yusro

Monorepo berisi tiga service:

- `frontend/`: SPA React/Vite, default port `5173`
- `backend/`: NestJS API, default port `3000`
- `ml-service/`: FastAPI service, default port `8000`

## Development

```bash
docker compose -f docker-compose.dev.yml up -d

cd frontend
npm install
npm run dev

cd ../backend
npm install
npm run start:dev

cd ../ml-service
python3.11 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Implementasi business logic, database model, scoring, dan pipeline ML masih berupa placeholder sesuai tahap scaffolding.
