import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'accent' | 'benar' | 'salah' | 'outline' | 'ghost' | 'off';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  /** [REKOMENDASI] State memuat (SDD 7.6): tombol disabled dan aria-busy="true". */
  isLoading?: boolean;
  /** Teks pengganti selama memuat; tanpa ini teks tombol tidak berubah. */
  loadingText?: ReactNode;
}

// Varian dari Figma. Bayangan padat "0 4px 0 <token hover varian>" juga pola Figma,
// karena SDD tidak mengatur bayangan tombol.
// [REKOMENDASI] Hover (SDD 7.6; warnanya tidak diatur SDD maupun Figma): varian berwarna
// memakai token -hover; outline -> neutral/surface-alt, ghost -> neutral/border, off tanpa hover.
const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-primary text-text-on-brand shadow-[0_4px_0_theme(colors.brand.primary-hover)] enabled:hover:bg-brand-primary-hover',
  accent: 'bg-brand-accent text-text-primary shadow-[0_4px_0_theme(colors.brand.accent-hover)] enabled:hover:bg-brand-accent-hover',
  benar: 'bg-feedback-benar text-text-on-brand shadow-[0_4px_0_theme(colors.feedback.benar-hover)] enabled:hover:bg-feedback-benar-hover',
  salah: 'bg-feedback-salah text-text-on-brand shadow-[0_4px_0_theme(colors.feedback.salah-hover)] enabled:hover:bg-feedback-salah-hover',
  outline: 'border-2 border-neutral-border-strong bg-neutral-surface text-text-primary shadow-[0_4px_0_theme(colors.neutral.border-strong)] enabled:hover:bg-neutral-surface-alt',
  ghost: 'bg-neutral-surface-alt text-text-secondary shadow-[0_4px_0_theme(colors.neutral.border)] enabled:hover:bg-neutral-border',
  off: 'bg-neutral-surface-alt text-text-muted',
};

// [REKOMENDASI] State SDD 7.6 (tidak ada di Figma):
// ditekan = turun 4px tanpa bayangan; fokus = outline 2px brand/primary offset 2px
// (outline, bukan ring, agar tidak bertumpuk dengan bayangan); disabled = tampilan off.
const stateClasses = [
  'enabled:active:translate-y-1 enabled:active:shadow-none',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary',
  'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-neutral-surface-alt disabled:text-text-muted disabled:shadow-none',
].join(' ');

export function Button({
  children,
  variant = 'primary',
  isLoading = false,
  loadingText,
  disabled,
  className = '',
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`inline-flex h-14 items-center justify-center rounded-md px-8 text-button transition ${variantClasses[variant]} ${stateClasses} ${className}`}
    >
      {isLoading && loadingText ? loadingText : children}
    </button>
  );
}
