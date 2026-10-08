import type { ReactNode } from 'react';

export type CardSize = 'default' | 'panel';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** panel: radius lg untuk panel besar (SDD 7.2.3), padding dasar 24 px; default: radius md, padding 32 px. */
  size?: CardSize;
}

// Radius dan padding dipilih kondisional agar tidak bertabrakan dengan className pemanggil.
const sizeClasses: Record<CardSize, string> = {
  default: 'rounded-md p-8',
  panel: 'rounded-lg p-6',
};

export function Card({ children, className = '', size = 'default' }: CardProps): JSX.Element {
  return <section className={`border-2 border-neutral-border bg-neutral-surface shadow-card ${sizeClasses[size]} ${className}`}>{children}</section>;
}
