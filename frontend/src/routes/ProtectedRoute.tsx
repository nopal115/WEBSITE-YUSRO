import type { ReactNode } from 'react'
import type { UserRole } from '../types'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { user } = useAuth()
  if (!user || (roles && !roles.includes(user.role))) return null
  return children
}
