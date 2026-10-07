export type ProgressColor = 'primary' | 'accent';

interface ProgressBarProps {
  value: number;
  max: number;
  color?: ProgressColor;
  className?: string;
}

export function ProgressBar({ value, max, color = 'primary', className = '' }: ProgressBarProps): JSX.Element {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fillClass = color === 'accent' ? 'bg-brand-accent' : 'bg-brand-primary';

  return (
    <div className={`h-3 w-full overflow-hidden rounded-full bg-neutral-border ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full rounded-full transition-[width] duration-300 ${fillClass}`} style={{ width: `${percentage}%` }} />
    </div>
  );
}
