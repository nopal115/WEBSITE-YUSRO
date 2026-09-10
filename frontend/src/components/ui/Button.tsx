import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'accent' | 'benar' | 'salah' | 'outline' | 'ghost' | 'off';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-primary text-text-on-brand hover:bg-brand-primary-hover',
  accent: 'bg-brand-accent text-text-primary hover:bg-brand-accent-hover',
  benar: 'bg-feedback-benar text-text-on-brand hover:bg-feedback-benar-hover',
  salah: 'bg-feedback-salah text-text-on-brand hover:bg-feedback-salah-hover',
  outline: 'border-2 border-brand-primary text-brand-primary hover:bg-brand-primary-soft',
  ghost: 'bg-transparent text-brand-primary hover:bg-brand-primary-soft',
  off: 'bg-neutral-locked text-text-secondary',
};

export function Button({ children, variant = 'primary', className = '', ...props }: ButtonProps): JSX.Element {
  return (
    <button
      className={`min-h-[56px] rounded-card px-6 py-3 text-button font-bold transition active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${variant === 'ghost' ? '' : 'shadow-md'} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
