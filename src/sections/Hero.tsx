import Countdown from '../components/Countdown';
import { BOOKING_OPENS, BOOKING_TIMEZONE, BOOKING_TIMEZONE_LABEL, BOOKING_URL } from '../config';
import { downloadIcs, googleCalendarUrl } from '../lib/calendar';
import { useCountdown } from '../lib/countdown';

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

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-5 py-3 text-center sm:px-8">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-saffron" />
        Techfest 2026
      </p>

      <h1
        className="mt-[2svh] text-[clamp(2.6rem,min(11.5vw,14.5svh),10rem)] leading-[0.85] font-black tracking-[-0.035em]"
        style={{ fontStretch: '115%' }}
      >
        ASTRAYUGA
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
          <a
            href={BOOKING_URL}
            className="rounded-full bg-ink px-6 py-3 text-[15px] font-medium text-paper transition-colors hover:bg-saffron"
          >
            Book your pass
          </a>
        ) : (
          <>
            <a
              href={googleCalendarUrl()}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-ink px-6 py-3 text-[15px] font-medium text-paper transition-colors hover:bg-saffron"
            >
              Remind me on 5 Dec
            </a>
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
