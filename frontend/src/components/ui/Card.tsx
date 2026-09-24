import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps): JSX.Element {
  return <section className={`rounded-[20px] border-2 border-neutral-border bg-white p-8 shadow-[0_3px_6px_rgba(15,26,36,0.06)] ${className}`}>{children}</section>;
}