import type { ReactNode } from 'react'
import { ProtectedRoute } from './ProtectedRoute'

export const appRoutes = (dashboard: ReactNode) => [
  { path: '/dashboard', element: <ProtectedRoute>{dashboard}</ProtectedRoute> },
]
