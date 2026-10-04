import { BookOpen, ClipboardList, History, House, TrendingUp, User, type LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Halaman lain yang menyalakan butir ini (mis. /statistik untuk Progress). */
  alsoActiveFor?: string[];
}

// Enam tujuan sesuai SRS NFR-USE-02; label mengikuti Figma.
// [REKOMENDASI] Pemetaan ikon Lucide, dicek ulang dengan Figma.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Beranda', to: '/', icon: House },
  { label: 'Pembelajaran', to: '/belajar', icon: BookOpen },
  { label: 'Tugas', to: '/tugas', icon: ClipboardList },
  // /statistik tidak masuk menu; diakses dari halaman Progress (keputusan proyek).
  { label: 'Progress', to: '/progress', icon: TrendingUp, alsoActiveFor: ['/statistik'] },
  { label: 'Riwayat', to: '/riwayat', icon: History },
  { label: 'Profil', to: '/profil', icon: User },
];

/** Bilah bawah mobile, empat butir (SDD 7.5.2): Tugas digabung ke Belajar, Riwayat ke Progress. */
export const BOTTOM_NAV_ITEMS: (NavItem & { activeFor: string[] })[] = [
  { label: 'Beranda', to: '/', icon: House, activeFor: ['/'] },
  { label: 'Belajar', to: '/belajar', icon: BookOpen, activeFor: ['/belajar', '/materi', '/tugas'] },
  { label: 'Progress', to: '/progress', icon: TrendingUp, activeFor: ['/progress', '/statistik', '/riwayat'] },
  { label: 'Akun', to: '/profil', icon: User, activeFor: ['/profil'] },
];

export function isPathActive(pathname: string, to: string): boolean {
  // "/" hanya aktif untuk beranda itu sendiri.
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Judul halaman yang tidak ada di menu. */
const EXTRA_TITLES = [
  { to: '/materi', title: 'Materi' },
  { to: '/statistik', title: 'Statistik' },
];

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  return isPathActive(pathname, item.to) || (item.alsoActiveFor ?? []).some((path) => isPathActive(pathname, path));
}

export function pageTitle(pathname: string): string {
  const extra = EXTRA_TITLES.find((item) => isPathActive(pathname, item.to));
  if (extra) return extra.title;
  return NAV_ITEMS.find((item) => isPathActive(pathname, item.to))?.label ?? '';
}
