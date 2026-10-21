import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/theme/useTheme';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps): JSX.Element {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
      aria-label={isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
      className={`flex h-11 items-center justify-center gap-2 rounded-md px-2.5 text-text-secondary transition-colors hover:bg-neutral-surface-alt hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary ${className}`}
    >
      <div className="relative flex h-6 w-6 items-center justify-center">
        {isDark ? (
          <Sun size={20} className="text-brand-accent transition-transform hover:rotate-45" aria-hidden="true" />
        ) : (
          <Moon size={20} className="text-text-secondary transition-transform hover:-rotate-12" aria-hidden="true" />
        )}
      </div>
      {showLabel && (
        <span className="text-body font-medium">
          {isDark ? 'Mode Terang' : 'Mode Gelap'}
        </span>
      )}
    </button>
  );
}
