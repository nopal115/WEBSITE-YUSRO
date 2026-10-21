import React, { useEffect, useState } from 'react';
import { ThemeContext, type Theme } from './useTheme';

export type { Theme } from './useTheme';

const THEME_KEY = 'yusro.theme';

export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  });

  const isDark = theme === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0C1317');
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0F4C5C');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage error
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
