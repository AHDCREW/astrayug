# Astrayuga — countdown

Single-screen countdown page for the Astrayuga techfest. Bookings open **5 Dec 2026, 00:00 IST**.

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

## Editing event details

Everything lives in [`src/config.ts`](src/config.ts): the opening time, time zone, the booking link that replaces the reminder button once the timer hits zero, and social links.

## The astronaut

A real-time 3D mascot built from three.js primitives with react-three-fiber. There's no model file. It floats in zero-g below the countdown: full body, a jetpack that puffs exhaust, and a tether running in from off-screen. It's in [`src/components/mascot/`](src/components/mascot/):

- [`Astronaut.tsx`](src/components/mascot/Astronaut.tsx) has the meshes and per-frame animation:
  - drifts and rolls slowly, with arms and legs treading the air;
  - leans toward the cursor when it comes close;
  - waves the arm nearest the cursor while grinning;
  - does a cartwheel with a jetpack burst when clicked.
- [`useMascotBrain.ts`](src/components/mascot/useMascotBrain.ts) has the behavior:
  - head and eyes follow the cursor;
  - blinks, and looks around on its own when the cursor rests;
  - grins when you hover a link or button;
  - records clicks for the cartwheel.
- [`MascotCanvas.tsx`](src/components/mascot/MascotCanvas.tsx) has the canvas, lighting, and a locally built reflection environment.

It's lazy-loaded, so the countdown paints first. It respects `prefers-reduced-motion`, and a hidden "Boop the astronaut" button makes it keyboard-accessible.

## Design

- Off-white `#F4F3EF`, near-black `#0E0E10`, one accent: saffron `#FF5B1F`.
- [Mona Sans](https://github.com/github/mona-sans) (SIL OFL) from Google Fonts.
- The logo is set in wide [Hubot Sans](https://github.com/github/hubot-sans) (SIL OFL), self-hosted through [`@fontsource-variable/hubot-sans`](https://fontsource.org/fonts/hubot-sans) because it isn't on Google Fonts. The mark is a saffron planet with an ink orbit, also used for the favicon.
- A custom cursor ([`Cursor.tsx`](src/components/Cursor.tsx)): a saffron dot with a trailing ink ring that swells over links, buttons and the astronaut. It only replaces the system cursor on mouse and trackpad.
- A pixel trail behind the page ([`CursorTrail.tsx`](src/components/CursorTrail.tsx)): saffron pixels that follow the pointer and fade. It's mouse and trackpad only, and off for `prefers-reduced-motion`.
- [React Bits](https://reactbits.dev) components in `src/components/reactbits/`:
  - **Counter**: rolling countdown digits.
  - **ClickSpark**: small monochrome sparks on click.
  - **PixelTrail**: the cursor trail.
  - **DecryptedText**: the logo and the big title scramble into saffron letters and decrypt back. The logo does it on hover. The title also decrypts on load and re-scrambles every few seconds, except with `prefers-reduced-motion`. It needs `motion`.
  - **ShinyText**: a saffron sweep across the "Techfest 2026" label.
  - **StarBorder**: a saffron star running round the main button, lapping it on hover.

## Claude Code skills

This repo includes Matt Pocock's [grill-me](https://github.com/mattpocock/skills) skill (MIT) in `.claude/skills/`. Run `/grill-me` to be interviewed about a plan before anything gets built.
