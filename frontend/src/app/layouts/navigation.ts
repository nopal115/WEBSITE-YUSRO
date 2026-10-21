import { Activity, AudioLines, BookOpen, ClipboardList, FileText, History, House, Layers, LayoutDashboard, TrendingUp, User, Users, type LucideIcon } from 'lucide-react';

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

/**
 * Menu teks navbar desktop Santri: lima butir tanpa Profil, yang menjadi tombol ikon di ujung kanan
 * (revisi desain pembimbing). Laci navigasi mobile tetap memakai NAV_ITEMS lengkap.
 */
export const TOP_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => item.to !== '/profil');

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

// Admin/Pengajar: tujuh tujuan sesuai sitemap SDD 12.5. Tanpa bilah bawah (terlalu banyak butir).
// [REKOMENDASI] Pemetaan ikon Lucide; tidak ada desain Figma untuk admin.
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
  { label: 'Santri', to: '/admin/santri', icon: Users },
  { label: 'Tahapan', to: '/admin/tahapan', icon: Layers },
  { label: 'Materi', to: '/admin/materi', icon: FileText },
  { label: 'Audio', to: '/admin/audio', icon: AudioLines },
  { label: 'Tugas', to: '/admin/tugas', icon: ClipboardList },
  { label: 'Monitoring', to: '/admin/monitoring', icon: Activity },
];

/** /admin hanya aktif untuk dashboard itu sendiri; butir lain juga aktif untuk halaman detailnya. */
export function isAdminNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.to === '/admin') return pathname === '/admin';
  return isPathActive(pathname, item.to);
}

export function adminPageTitle(pathname: string): string {
  return ADMIN_NAV_ITEMS.find((item) => isAdminNavItemActive(pathname, item))?.label ?? '';
}
