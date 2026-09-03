import { createContext, type ReactNode } from 'react'
import type { User } from '../types'

export const AuthContext = createContext<{ user: User | null }>({ user: null })
export function AuthProvider({ children }: { children: ReactNode }) { return <AuthContext.Provider value={{ user: null }}>{children}</AuthContext.Provider> }
