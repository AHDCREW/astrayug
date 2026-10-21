import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'theme';
const THEME_COLOR = { light: '#f4f3ef', dark: '#0d0d10' };

type Ctx = { theme: Theme; toggle: (origin?: { x: number; y: number }) => void };
const ThemeContext = createContext<Ctx | null>(null);

// index.html has already put the class on <html> before first paint.
const initial = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', THEME_COLOR[theme]);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial);

  // Follow the OS setting until the visitor has picked a theme themselves.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      try {
        if (localStorage.getItem(KEY)) return;
      } catch {
        // storage blocked: keep following the OS
      }
      const next = mq.matches ? 'dark' : 'light';
      apply(next);
      setTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback((origin?: { x: number; y: number }) => {
    const next: Theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the choice just won't persist
    }
    const commit = () => {
      apply(next);
      setTheme(next);
    };
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduced) return commit();
    if (origin) {
      root.style.setProperty('--tx', `${origin.x}px`);
      root.style.setProperty('--ty', `${origin.y}px`);
    }
    document.startViewTransition(commit);
  }, []);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
