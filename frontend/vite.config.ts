import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [react()],
    // VITE_USE_MOCK selalu diganti menjadi literal (bawaan 'false'), sehingga cabang mock di
    // lib/api/client.ts menjadi kode mati dan modul mock tidak ikut ter-bundle saat flag mati.
    define: { 'import.meta.env.VITE_USE_MOCK': JSON.stringify(env.VITE_USE_MOCK ?? 'false') },
    // Hanya server dev: /api diteruskan ke backend lokal sehingga browser tidak terkena CORS
    // (backend belum memanggil enableCors). Pakai VITE_API_BASE_URL=/api/v1 di frontend/.env.
    server: { proxy: { '/api': 'http://localhost:3000' } },
  };
});
