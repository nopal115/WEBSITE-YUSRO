import { UserRound } from 'lucide-react';
import { useState } from 'react';

/** Inisial: huruf pertama dua kata pertama nama. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('') || '?';
}

type AvatarSize = 'sm' | 'lg';

// sm 32px untuk header, lg 96px untuk kartu profil.
const sizeClasses: Record<AvatarSize, string> = { sm: 'h-8 w-8 text-label', lg: 'h-24 w-24 text-h2' };

/**
 * Avatar bulat: foto bila ada; tanpa foto (atau foto gagal dimuat) menampilkan inisial nama, atau ikon orang
 * bila fallback="icon". Selalu dekoratif (alt kosong), jadi pemanggil memberi nama aksesibel;
 * [REKOMENDASI] bentuk bulat tidak diatur SDD 7.4.
 */
export function Avatar({ name = '', src, size = 'sm', fallback = 'initials' }: { name?: string; src: string | null | undefined; size?: AvatarSize; fallback?: 'initials' | 'icon' }): JSX.Element {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src && src !== failedSrc;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-primary-soft font-semibold text-brand-primary ${sizeClasses[size]}`} aria-hidden="true">
      {showImage ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailedSrc(src)} />
      ) : fallback === 'icon' ? (
        <UserRound size={size === 'lg' ? 48 : 20} />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
