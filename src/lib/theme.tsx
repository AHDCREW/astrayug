import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { msToTurn, nightAt, startHalf } from './sky';

export type Theme = 'light' | 'dark';

const KEY = 'theme';
const THEME_COLOR = { light: '#f4f3ef', dark: '#0d0d10' };

type Ctx = { theme: Theme; toggle: (origin?: { x: number; y: number }) => void };
const ThemeContext = createContext<Ctx | null>(null);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// index.html has already put the class on <html> before first paint.
const current = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', THEME_COLOR[theme]);
}

// How a new theme comes in. From the toggle, a circle of it grows out of the button. At
// the sky's own sunset and sunrise ('sky'), it sweeps in slowly from the east with a soft
// edge: night rising opposite the setting sun, then dawn spreading from where the sun
// comes up. With null, or without view transitions, it changes all at once.
type Reveal = { from?: { x: number; y: number } } | 'sky' | null;

function reveal(commit: () => void, how: Reveal) {
  const root = document.documentElement;
  if (!how || !document.startViewTransition || reduced) return commit();
  if (how === 'sky') {
    root.dataset.reveal = 'sky';
    document.startViewTransition(commit).finished.finally(() => delete root.dataset.reveal);
    return;
  }
  delete root.dataset.reveal;
  if (how.from) {
    root.style.setProperty('--tx', `${how.from.x}px`);
    root.style.setProperty('--ty', `${how.from.y}px`);
  }
  document.startViewTransition(commit);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(current);

  const go = useCallback((next: Theme, how: Reveal) => {
    reveal(() => {
      apply(next);
      setTheme(next);
    }, how);
  }, []);

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
      startHalf(next === 'dark');
      go(next, null);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [go]);

  // The theme follows the sky (lib/sky.ts): dark from sunset, light from sunrise. Each
  // turn is timed from the clock, so after the toggle moves it, the next timer just finds
  // nothing to change and times the turn after. A hidden tab's timers are held back, so
  // it catches up at once when the tab is back.
  useEffect(() => {
    if (reduced) return;
    const follow = (how: Reveal) => {
      const next: Theme = nightAt(performance.now()) ? 'dark' : 'light';
      if (next !== current()) go(next, how);
    };
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          follow('sky');
          schedule();
        },
        msToTurn(performance.now()) + 20,
      );
    };
    const onVisible = () => {
      if (!document.hidden) follow(null);
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [go]);

  // Skips ahead to sunset or sunrise, and the sky carries on from there. The choice is
  // kept, so the next visit starts in the same half.
  const toggle = useCallback(
    (origin?: { x: number; y: number }) => {
      const next: Theme = current() === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // storage blocked: the choice just won't persist
      }
      startHalf(next === 'dark');
      go(next, { from: origin });
    },
    [go],
  );

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
