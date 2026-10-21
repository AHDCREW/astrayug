import DecryptedText from './reactbits/DecryptedText/DecryptedText';

// A saffron planet with an ink orbit, then the wordmark in wide Hubot Sans.
// The orbit is drawn twice so its front arc passes over the planet.
export default function Logo() {
  return (
    <a href="/" className="group flex items-center gap-2" aria-label="Astrayuga home">
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
      <span className="font-logo text-[15px] font-extrabold tracking-[0.04em]" style={{ fontStretch: '125%' }}>
        <DecryptedText
          text="ASTRAYUGA"
          animateOn="hover"
          sequential
          useOriginalCharsOnly
          speed={40}
          scrambleColor="#ff5b1f"
        />
      </span>
    </a>
  );
}
