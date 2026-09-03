import type { ReactNode } from 'react'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return <div className="dashboard-layout">{children}</div>
}
