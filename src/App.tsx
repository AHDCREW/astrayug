import { lazy, Suspense } from 'react';
import ClickSpark from './components/reactbits/ClickSpark/ClickSpark';
import Logo from './components/Logo';
import { FEST_NAME, SOCIALS } from './config';
import { googleCalendarUrl } from './lib/calendar';
import Hero from './sections/Hero';

const MascotCanvas = lazy(() => import('./components/mascot/MascotCanvas'));

export default function App() {
  return (
    <ClickSpark sparkColor="#0e0e10" sparkCount={7} sparkSize={8} sparkRadius={18} duration={420}>
      <div className="flex min-h-svh flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7">
          <Logo />
          <a
            href={googleCalendarUrl()}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-ink"
          >
            Remind me
          </a>
        </header>

        <main className="flex flex-1 flex-col">
          <Hero />

          <div className="relative h-[clamp(200px,min(36svh,62vw),460px)] shrink-0">
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
            <Suspense fallback={null}>
              <MascotCanvas />
            </Suspense>
          </div>
        </main>
      </div>
    </ClickSpark>
  );
}
