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

A real-time 3D mascot built from three.js primitives with react-three-fiber. There's no model file. It's in [`src/components/mascot/`](src/components/mascot/):

- [`Astronaut.tsx`](src/components/mascot/Astronaut.tsx) has the meshes and per-frame animation.
- [`useMascotBrain.ts`](src/components/mascot/useMascotBrain.ts) has the behavior:
  - head and eyes follow the cursor;
  - blinks, and looks around on its own when the cursor rests;
  - peeks higher when the cursor is near;
  - grins when you hover a link or button;
  - hops when clicked.
- [`MascotCanvas.tsx`](src/components/mascot/MascotCanvas.tsx) has the canvas, lighting, and a locally built reflection environment.

It's lazy-loaded, so the countdown paints first. It respects `prefers-reduced-motion`, and a hidden "Boop the astronaut" button makes it keyboard-accessible.

## Design

- Off-white `#F4F3EF`, near-black `#0E0E10`, one accent: saffron `#FF5B1F`.
- [Mona Sans](https://github.com/github/mona-sans) (SIL OFL) from Google Fonts.
- Two [React Bits](https://reactbits.dev) components in `src/components/reactbits/`: **Counter** (rolling countdown digits) and **ClickSpark** (small monochrome sparks on click).

## Claude Code skills

This repo includes Matt Pocock's [grill-me](https://github.com/mattpocock/skills) skill (MIT) in `.claude/skills/`. Run `/grill-me` to be interviewed about a plan before anything gets built.
