import { lazy, Suspense, useEffect, useState } from 'react';
import ClickSpark from './components/reactbits/ClickSpark/ClickSpark';
import Cursor from './components/Cursor';
import CursorTrail from './components/CursorTrail';
import Logo from './components/Logo';
import SkipOnError from './components/SkipOnError';
import Sun from './components/Sun';
import { FEST_NAME, SOCIALS } from './config';
import { googleCalendarUrl } from './lib/calendar';
import { useTheme } from './lib/theme';
import ThemeToggle from './components/ThemeToggle';
import Hero from './sections/Hero';

const MascotCanvas = lazy(() => import('./components/mascot/MascotCanvas'));

// The mascot is about a megabyte of three.js, so it only starts downloading once the
// page has painted and gone idle. That way it never competes with the countdown.
// Safari has no requestIdleCallback, so it gets a short timeout instead.
function useWhenIdle() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const go = () => setIdle(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(go, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(go, 600);
    return () => window.clearTimeout(id);
  }, []);
  return idle;
}

export default function App() {
  const showMascot = useWhenIdle();
  const { theme } = useTheme();

  return (
    <>
      {/* Light mode's sky, with the sun crossing it. It's first, so it paints under everything. */}
      <Sun />
      <ClickSpark sparkColor={theme === 'dark' ? '#f4f3ef' : '#0e0e10'} sparkCount={7} sparkSize={8} sparkRadius={18} duration={420}>
        {/* The trail comes first and the page is positioned after it, so the trail paints underneath. */}
        <CursorTrail />
        {/* On upright touch screens the page doesn't scroll (see index.css), so it's exactly
            one screen tall, and on the smallest phones the mascot's strip gives up height
            so everything still fits. */}
        <div className="relative flex min-h-svh flex-col touch-portrait:h-svh">
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7">
            <Logo />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <a
                href={googleCalendarUrl()}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-ink"
              >
                Remind me
              </a>
            </div>
          </header>

          <main className="flex flex-1 flex-col touch-portrait:min-h-0">
            <Hero />

            <div className="relative h-[clamp(200px,min(36svh,62vw),460px)] shrink-0 touch-portrait:min-h-[120px] touch-portrait:shrink">
              <footer className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto flex max-w-6xl flex-wrap justify-center gap-x-5 gap-y-1 px-5 text-xs text-muted sm:top-auto sm:bottom-0 sm:justify-between sm:px-8 sm:pb-6 sm:text-sm">
                <span>© 2026 {FEST_NAME}</span>
                <ul className="pointer-events-auto flex gap-5">
                  {SOCIALS.map(s => (
                    <li key={s.label}>
                      <a href={s.href} className="transition-colors hover:text-ink">
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </footer>
              {showMascot && (
                <SkipOnError>
                  <Suspense fallback={null}>
                    <MascotCanvas />
                  </Suspense>
                </SkipOnError>
              )}
            </div>
          </main>
        </div>
      </ClickSpark>
      <Cursor />
    </>
  );
}
