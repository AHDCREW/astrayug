import DecryptedText from './reactbits/DecryptedText/DecryptedText';

// Each word of the wordmark scrambles on its own when hovered.
const SCRAMBLE = {
  animateOn: 'hover',
  sequential: true,
  useOriginalCharsOnly: true,
  speed: 40,
  scrambleColor: '#ff5b1f',
} as const;

// A saffron planet with an ink orbit, then the wordmark ASTRA | YUGA in wide Hubot
// Sans, with a saffron bar for the "|". The orbit is drawn twice so its front arc
// passes over the planet.
export default function Logo() {
  return (
    <a href="/" className="group flex items-center gap-2" aria-label="Astra Yuga home">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-6 shrink-0 transition-transform duration-500 ease-out group-hover:rotate-[24deg] motion-reduce:transition-none"
      >
        <g transform="rotate(-20 12 12)" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <ellipse cx="12" cy="12" rx="10.5" ry="3.5" />
          <circle cx="12" cy="12" r="5.5" stroke="none" className="fill-saffron" />
          <path d="M1.5 12A10.5 3.5 0 0 0 22.5 12" />
        </g>
      </svg>
      {/* A size smaller on the narrowest phones, so it clears the "Remind me" button. */}
      <span
        className="font-logo text-[13px] font-extrabold tracking-[0.04em] whitespace-nowrap min-[360px]:text-[15px]"
        style={{ fontStretch: '125%' }}
      >
        <DecryptedText text="ASTRA" {...SCRAMBLE} />{' '}
        <span aria-hidden="true" className="inline-block h-[0.73em] w-[2px] bg-saffron" />{' '}
        <DecryptedText text="YUGA" {...SCRAMBLE} />
      </span>
    </a>
  );
}
