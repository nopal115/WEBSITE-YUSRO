import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DengarPilihPage } from '../features/quiz/DengarPilihPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';
import { PlaceholderPage } from './PlaceholderPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <PlaceholderPage>Login</PlaceholderPage>,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
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
