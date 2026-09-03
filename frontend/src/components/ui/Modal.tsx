import type { ReactNode } from 'react'
export function Modal({ children }: { children: ReactNode }) { return <dialog open>{children}</dialog> }
