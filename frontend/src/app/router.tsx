import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DengarPilihPage } from '../features/quiz/DengarPilihPage';
import { LoginPage } from '../features/auth/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AdminPlaceholderPage } from './AdminPlaceholderPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';
import { PlaceholderPage } from './PlaceholderPage';

export const router = createBrowserRouter([
  {
    // Admin yang membuka "/" akan diarahkan ProtectedRoute ke /admin.
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        // TODO: registrasi santri (SRS UC 6.4, Figma layar 02), di luar tugas ini.
        path: '/registrasi',
        element: <PlaceholderPage>Registrasi</PlaceholderPage>,
      },
      {
        // TODO: backend belum punya endpoint reset password.
        path: '/lupa-password',
        element: <PlaceholderPage>Lupa password</PlaceholderPage>,
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['ADMIN']} />,
    children: [
      {
        // TODO(admin): [TBD] placeholder sampai halaman Admin/Pengajar dirancang.
        path: '/admin',
        element: <AdminPlaceholderPage />,
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['SANTRI']} />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/dashboard',
            element: <DashboardPage />,
          },
          {
            path: '/pembelajaran',
            element: <PlaceholderPage>Pembelajaran</PlaceholderPage>,
          },
          {
            path: '/progress',
            element: <PlaceholderPage>Progress</PlaceholderPage>,
          },
          {
            // ASUMSI: "Riwayat" = modul report (SDD 3.15), perlu dikonfirmasi
            path: '/riwayat',
            element: <PlaceholderPage>Riwayat</PlaceholderPage>,
          },
          {
            path: '/profil',
            element: <PlaceholderPage>Profil</PlaceholderPage>,
          },
          {
            path: '/quiz/demo',
            element: <DengarPilihPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <div className="p-8">404 Not Found</div>,
  },
]);
