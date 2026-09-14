import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DengarPilihPage } from '../features/quiz/DengarPilihPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';

const PlaceholderPage = ({ children }: { children: string }): JSX.Element => (
  <div className="p-8">{children} (belum dibuat)</div>
);

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
            element: <PlaceholderPage>Dashboard</PlaceholderPage>,
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
