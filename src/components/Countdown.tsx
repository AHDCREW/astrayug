import Counter from './reactbits/Counter/Counter';
import type { TimeLeft } from '../lib/countdown';

const UNITS: { key: keyof Omit<TimeLeft, 'done'>; label: string }[] = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'seconds', label: 'Seconds' },
];

export default function Countdown({ left }: { left: TimeLeft }) {
  return (
    <div
      className="mx-auto grid w-full max-w-2xl grid-cols-4 divide-x divide-line"
      role="timer"
      aria-label={`${left.days} days, ${left.hours} hours, ${left.minutes} minutes and ${left.seconds} seconds until bookings open`}
    >
      {UNITS.map(({ key, label }) => (
        <div key={key} className="flex flex-col items-center px-1">
          <Counter
            value={left[key]}
            minDigits={2}
            direction="down"
            fontSize="clamp(2.25rem, min(9vw, 9.5svh), 5.5rem)"
            tabular={false}
            fontWeight={600}
            stagger={0.04}
            className="tracking-tight"
          />
          <span className="mt-1 text-[11px] font-medium tracking-[0.14em] text-muted uppercase sm:mt-2 sm:text-xs">{label}</span>
        </div>
      ))}
    </div>
  );
}
