import { BookOpen, ClipboardList, History, House, TrendingUp, User, type LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

// Enam tujuan sesuai SRS NFR-USE-02; label mengikuti Figma.
// [REKOMENDASI] Pemetaan ikon Lucide, dicek ulang dengan Figma.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Beranda', to: '/dashboard', icon: House },
  { label: 'Pembelajaran', to: '/pembelajaran', icon: BookOpen },
  { label: 'Tugas', to: '/tugas', icon: ClipboardList },
  { label: 'Progress', to: '/progress', icon: TrendingUp },
  { label: 'Riwayat', to: '/riwayat', icon: History },
  { label: 'Profil', to: '/profil', icon: User },
];

/** Bilah bawah mobile, empat butir (SDD 7.5.2): Tugas digabung ke Belajar, Riwayat ke Progress. */
export const BOTTOM_NAV_ITEMS: (NavItem & { activeFor: string[] })[] = [
  { label: 'Beranda', to: '/dashboard', icon: House, activeFor: ['/dashboard'] },
  { label: 'Belajar', to: '/pembelajaran', icon: BookOpen, activeFor: ['/pembelajaran', '/tugas'] },
  { label: 'Progress', to: '/progress', icon: TrendingUp, activeFor: ['/progress', '/riwayat'] },
  { label: 'Akun', to: '/profil', icon: User, activeFor: ['/profil'] },
];

export function isPathActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function pageTitle(pathname: string): string {
  return NAV_ITEMS.find((item) => isPathActive(pathname, item.to))?.label ?? '';
}
