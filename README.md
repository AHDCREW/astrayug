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

## Day and night

The page runs a 30-second day and night on a loop. By day it's in light mode, and a sun rises bottom left, arcs over the top and sets bottom right. At sunset it turns to dark mode, and a full moon rises bottom left with the stars coming out, crosses the same way, and sets as the sun comes back up. Each turn sweeps in from the bottom left with a soft edge. The sun or moon lights the astronaut and glints off its gold visor, and the sun casts the title's shadow. The theme toggle skips ahead to the next sunset or sunrise.

The clock is [`src/lib/sky.ts`](src/lib/sky.ts), which has the day and night lengths. The theme follows it in [`src/lib/theme.tsx`](src/lib/theme.tsx). The sky itself is [`src/components/Sky.tsx`](src/components/Sky.tsx), with its styles in `index.css`. The astronaut's side is [`Lighting.tsx`](src/components/mascot/Lighting.tsx) and the glint in `Astronaut.tsx`. With reduced motion the clock stops: the sun or moon holds still, and the theme only changes with the toggle.

## Low-end and high-end devices

The page scales its effects to the device:

- **The first guess:** [`src/lib/device.ts`](src/lib/device.ts) makes a one-off guess from what the browser reports. Low end means 2 GB or less of memory, 4 cores or fewer, Save-Data, or a 2G connection.
- **The mascot adapts at runtime:**
  - It starts at the device's pixel ratio (capped at 2), or at 1x on low-end devices.
  - drei's `PerformanceMonitor` then steps the ratio down when frames drop and back up when there's headroom.
  - If frames still drop at 1x, it switches to a lite path: plain materials without clearcoat or sheen, no reflection environment, and fewer polygons.
  - It stops rendering while scrolled off-screen.
  - The wrapper's `data-quality` attribute shows `full` or `lite`.
- **The mascot loads late and fails safely:** it only starts downloading once the page is idle. It's wrapped in [`SkipOnError`](src/components/SkipOnError.tsx), so without WebGL the countdown still works.
- **Lighter extras on low-end devices:**
  - The pixel trail renders at 1x (1.5x at most elsewhere), plots fewer points and skips its colour ramp.
  - The button's star border skips its sparkle dust.

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
  - **DecryptedText**: the logo and the big title scramble into saffron letters and decrypt back. The logo does it on hover. The title also decrypts on load and re-scrambles every few seconds, except with `prefers-reduced-motion`. It's changed locally to render a plain `<span>` instead of `motion.span`, which keeps the `motion` package out of the bundle.
  - **ShinyText**: a saffron sweep across the "Techfest 2026" label.
  - **StarBorder**: a saffron star running round the main button, lapping it on hover.

## Claude Code skills

This repo includes Matt Pocock's [grill-me](https://github.com/mattpocock/skills) skill (MIT) in `.claude/skills/`. Run `/grill-me` to be interviewed about a plan before anything gets built.
