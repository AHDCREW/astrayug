import Countdown from '../components/Countdown';
import DecryptedText from '../components/reactbits/DecryptedText/DecryptedText';
import ShinyText from '../components/reactbits/ShinyText/ShinyText';
import StarBorder from '../components/reactbits/StarBorder/StarBorder';
import { BOOKING_OPENS, BOOKING_TIMEZONE, BOOKING_TIMEZONE_LABEL, BOOKING_URL } from '../config';
import { downloadIcs, googleCalendarUrl } from '../lib/calendar';
import { useCountdown } from '../lib/countdown';
import { lowEnd } from '../lib/device';
import { useTheme } from '../lib/theme';

// DecryptedText's loop scrambles the title out and back in. With reduced motion it
// skips the way back in and stays scrambled, so the loop is left off then.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Each word of the title scrambles on its own: on load, on hover, and every few seconds.
const TITLE_SCRAMBLE = {
  animateOn: 'inViewHover',
  sequential: true,
  useOriginalCharsOnly: true,
  speed: 50,
  scrambleColor: '#ff5b1f',
  loop: !reducedMotion,
  loopDelay: 6000,
} as const;

// The primary call to action: an ink pill with a saffron star running round its
// edge, which laps the button on hover. The sparkle dust it sheds is extra canvas
// work every frame, so low-end devices go without.
const CTA = {
  theme: 'dark',
  radius: 999,
  color: '#ff5b1f',
  backgroundColor: 'var(--ink)',
  textColor: 'var(--paper)',
  sparkle: !lowEnd,
  className: 'text-[15px]',
} as const;

const festDate = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: BOOKING_TIMEZONE,
}).format(BOOKING_OPENS);

const festTime = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: BOOKING_TIMEZONE,
}).format(BOOKING_OPENS);

// Only show the viewer's own time when it differs from the fest's time zone.
const clock = (timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', { day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone }).format(BOOKING_OPENS);
const localTime =
  clock() !== clock(BOOKING_TIMEZONE)
    ? new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(BOOKING_OPENS)
    : null;

export default function Hero() {
  const left = useCountdown(BOOKING_OPENS);
  const { theme } = useTheme();

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-5 py-3 text-center sm:px-8">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-saffron" />
        <ShinyText text="Techfest 2026" color={theme === 'dark' ? '#9b9ba3' : '#6b6b70'} shineColor="#ff5b1f" speed={2.2} delay={2.5} shineWidth={30} />
      </p>

      {/* ASTRA | YUGA, with a saffron bar for the "|". It sits on the baseline and is
          cap height (0.73em in Mona Sans). The spaces around it also keep the words
          apart for screen readers. */}
      <h1
        className="mt-[2svh] text-[clamp(2rem,min(11.5vw,14.5svh),9rem)] leading-[0.85] font-black tracking-[-0.035em] whitespace-nowrap"
        style={{ fontStretch: '115%' }}
      >
        <DecryptedText text="ASTRA" {...TITLE_SCRAMBLE} />{' '}
        <span aria-hidden="true" className="inline-block h-[0.73em] w-[0.08em] bg-saffron" />{' '}
        <DecryptedText text="YUGA" {...TITLE_SCRAMBLE} />
      </h1>

      <p className="mt-[3svh] max-w-md text-base text-muted sm:max-w-none sm:text-lg">
        {left.done ? 'Bookings are live.' : 'Bookings open'}{' '}
        {!left.done && (
          <span className="text-ink">
            {festDate}, {festTime} {BOOKING_TIMEZONE_LABEL}
          </span>
        )}
      </p>
      {localTime && !left.done && <p className="mt-1 text-sm text-muted">That's {localTime} for you.</p>}

      {!left.done && (
        <div className="mt-[4svh] w-full">
          <Countdown left={left} />
        </div>
      )}

      <div className="mt-[4svh] flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {left.done ? (
          <StarBorder as="a" href={BOOKING_URL} {...CTA}>
            Book your pass
          </StarBorder>
        ) : (
          <>
            <StarBorder as="a" href={googleCalendarUrl()} target="_blank" rel="noreferrer" {...CTA}>
              Remind me on 5 Dec
            </StarBorder>
            <button
              type="button"
              onClick={downloadIcs}
              className="cursor-pointer text-[15px] font-medium underline decoration-line decoration-2 underline-offset-4 transition-colors hover:decoration-ink"
            >
              Download .ics
            </button>
          </>
        )}
      </div>
    </section>
  );
}
