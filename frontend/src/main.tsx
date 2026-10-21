import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/providers';
import { router } from './app/router';
import './styles/index.css';

// PWA Service Worker: hanya di build produksi. Di server dev, service worker cache-first menyimpan modul /src
// sehingga reload menampilkan kode lama; yang terlanjur terpasang dilepas dan cache-nya dihapus.
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('[PWA] Service Worker gagal didaftarkan:', error);
      });
    });
  } else {
    void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
    if ('caches' in window) {
      void caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('yusro-pwa-')).map((key) => caches.delete(key))));
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </React.StrictMode>,
);
