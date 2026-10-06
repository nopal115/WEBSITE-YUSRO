import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { StageListPage } from '../features/learning/StageListPage';
import { MaterialDetailPage } from '../features/learning/MaterialDetailPage';
import { AttemptDetailPage } from '../features/progress/AttemptDetailPage';
import { HistoryPage } from '../features/progress/HistoryPage';
import { ImitationTaskPage } from '../features/imitation/ImitationTaskPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { QuizTaskPage } from '../features/quiz/QuizTaskPage';
import { StageMaterialsPage } from '../features/learning/StageMaterialsPage';
import { ListSkeleton } from '../features/learning/QueryStates';
import { AdminDashboardPage } from '../features/admin/dashboard/AdminDashboardPage';
import { StudentListPage } from '../features/admin/students/StudentListPage';
import { MonitoringPage } from '../features/admin/monitoring/MonitoringPage';
import { StageManagementPage } from '../features/admin/content/StageManagementPage';
import { AdminLayout } from './layouts/AdminLayout';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';
import { PlaceholderPage } from './PlaceholderPage';

// Statistik dan Detail Santri memuat Recharts (ukuran besar), jadi dipisah ke chunk sendiri dan hanya diunduh saat dibuka.
// eslint-disable-next-line react-refresh/only-export-components -- berkas konfigurasi rute, bukan modul fast refresh.
const StudentDetailPage = lazy(() => import('../features/admin/students/StudentDetailPage').then((module) => ({ default: module.StudentDetailPage })));
// eslint-disable-next-line react-refresh/only-export-components -- berkas konfigurasi rute, bukan modul fast refresh.
const StatisticsPage = lazy(() => import('../features/statistics/StatisticsPage').then((module) => ({ default: module.StatisticsPage })));

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
        // Sitemap SDD 12.5 bagian Admin/Pengajar.
        element: <AdminLayout />,
        children: [
          {
            path: '/admin',
            element: <AdminDashboardPage />,
          },
          {
            path: '/admin/santri',
            element: <StudentListPage />,
          },
          {
            // Dimuat terpisah: grafik Recharts (keputusan A2).
            path: '/admin/santri/:studentId',
            element: (
              <Suspense
                fallback={
                  <div className="mx-auto max-w-[1040px]">
                    <ListSkeleton rows={3} />
                  </div>
                }
              >
                <StudentDetailPage />
              </Suspense>
            ),
          },
          {
            path: '/admin/tahapan',
            element: <StageManagementPage />,
          },
          {
            // [TBD] Placeholder; dikerjakan di tugas A4 (Tahapan & Materi).
            path: '/admin/materi',
            element: <PlaceholderPage>Materi</PlaceholderPage>,
          },
          {
            // [TBD] Placeholder; dikerjakan di tugas A4 (Tahapan & Materi).
            path: '/admin/materi/:materialId',
            element: <PlaceholderPage>Editor Materi</PlaceholderPage>,
          },
          {
            // [TBD] Placeholder; dikerjakan di tugas A5 (Audio).
            path: '/admin/audio',
            element: <PlaceholderPage>Audio</PlaceholderPage>,
          },
          {
            // [TBD] Placeholder; dikerjakan di tugas A6 (Tugas & Soal).
            path: '/admin/tugas',
            element: <PlaceholderPage>Tugas</PlaceholderPage>,
          },
          {
            // [TBD] Placeholder; dikerjakan di tugas A6 (Tugas & Soal).
            path: '/admin/tugas/:taskId',
            element: <PlaceholderPage>Editor Tugas</PlaceholderPage>,
          },
          {
            path: '/admin/monitoring',
            element: <MonitoringPage />,
          },
        ],
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
            path: '/materi/:materialId',
            element: <MaterialDetailPage />,
          },
          {
            // Tidak ada di sitemap SDD 12.5; [TBD] menunggu konfirmasi pembimbing.
            // [TBD] NFR-USE-02 mewajibkan menu Tugas; isi halaman belum didefinisikan SRS/SDD/Figma, menunggu konfirmasi pembimbing.
            path: '/tugas',
            element: <PlaceholderPage>Tugas</PlaceholderPage>,
          },
          {
            path: '/progress',
            element: <ProgressPage />,
          },
          {
            // Tidak masuk menu; diakses dari halaman Progress (keputusan proyek, sitemap SDD 12.5).
            path: '/statistik',
            element: (
              <Suspense
                fallback={
                  <div className="mx-auto max-w-[1040px]">
                    <ListSkeleton rows={2} />
                  </div>
                }
              >
                <StatisticsPage />
              </Suspense>
            ),
          },
          {
            path: '/riwayat',
            element: <HistoryPage />,
          },
          {
            // [TBD] Tidak ada di sitemap SDD 12.5; akan dimasukkan ke revisi SDD.
            path: '/riwayat/:attemptId',
            element: <AttemptDetailPage />,
          },
          {
            path: '/profil',
            element: <ProfilePage />,
          },
        ],
      },
      {
        // Dengar-Pilih (SDD 12.5): layar penuh tanpa sidebar dan bilah bawah (Figma 07–09).
        path: '/tugas/:taskId/pilih',
        element: <QuizTaskPage />,
      },
      {
        // Dengar-Tirukan (SDD 12.5): layar penuh tanpa sidebar dan bilah bawah, seperti Dengar-Pilih.
        path: '/tugas/:taskId/tirukan',
        element: <ImitationTaskPage />,
      },
    ],
  },
  {
    path: '*',
    element: <div className="p-8">404 Not Found</div>,
  },
]);
