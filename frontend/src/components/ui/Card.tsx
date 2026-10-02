import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps): JSX.Element {
  return <section className={`rounded-md border-2 border-neutral-border bg-white p-8 shadow-card ${className}`}>{children}</section>;
}