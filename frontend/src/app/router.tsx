import { createBrowserRouter } from 'react-router-dom';
import { DengarPilihPage } from '../features/quiz/DengarPilihPage';
import { LoginPage } from '../features/auth/LoginPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { StageListPage } from '../features/learning/StageListPage';
import { StageMaterialsPage } from '../features/learning/StageMaterialsPage';
import { AdminPlaceholderPage } from './AdminPlaceholderPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';
import { PlaceholderPage } from './PlaceholderPage';

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/register',
        element: <RegisterPage />,
      },
      {
        path: '/forgot-password',
        element: <ForgotPasswordPage />,
      },
      {
        path: '/reset-password',
        element: <ResetPasswordPage />,
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
            // Sitemap SDD 12.5. Admin yang membuka "/" diarahkan ProtectedRoute ke /admin.
            path: '/',
            element: <DashboardPage />,
          },
          {
            path: '/belajar',
            element: <StageListPage />,
          },
          {
            path: '/belajar/:stageId',
            element: <StageMaterialsPage />,
          },
          {
            // Tidak ada di sitemap SDD 12.5; [TBD] menunggu konfirmasi pembimbing.
            // [TBD] NFR-USE-02 mewajibkan menu Tugas; isi halaman belum didefinisikan SRS/SDD/Figma, menunggu konfirmasi pembimbing.
            path: '/tugas',
            element: <PlaceholderPage>Tugas</PlaceholderPage>,
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
        ],
      },
      {
        // Layar latihan tampil penuh, tanpa sidebar dan bilah bawah (Figma 07–17).
        // TODO: Diganti /tugas/:taskId/pilih (SDD 12.5) saat Dengar-Pilih dibangun.
        path: '/quiz/demo',
        element: <DengarPilihPage />,
      },
    ],
  },
  {
    path: '*',
    element: <div className="p-8">404 Not Found</div>,
  },
]);
