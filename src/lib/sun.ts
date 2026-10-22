import type { Vector3 } from 'three';

// Light mode's day, fifteen seconds long. The sun rises at the bottom left of the page,
// arcs over it and sets at the bottom right. A short twilight follows while it's below
// the horizon: the afterglow fades on the right, dawn builds on the left, and it comes
// up again. The page's sky (components/Sun.tsx) and the astronaut's light both read it
// from here, so the two stay in step.

export const DAY_MS = 15000;

// The share of the day the sun is up. The rest is twilight.
const UP = 0.88;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface Sun {
  // Across the sky: -1 on the left horizon, 1 on the right.
  x: number;
  // Up the sky: 0 on the horizon, 1 at the top of the arc, below 0 once it's set.
  y: number;
  // Direct sunlight: none once the sun is down, full once it's clear of the horizon.
  light: number;
  // How low and red the light is: 1 on the horizon, 0 once the sun is well up.
  warmth: number;
  // The glow along the horizon on the sun's side, brightest as it rises and sets.
  glow: number;
  // How deep into twilight: 0 while the sun is up, 1 halfway from sunset to dawn.
  dusk: number;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The last of the light goes as the sun sinks through the horizon.
const lightAt = (y: number) => smoothstep(-0.04, 0.12, y);

let start = 0;

// Starts the day over from the middle of the night, so dawn breaks a moment after
// light mode comes on and the sun follows it up.
export function newDay(now = performance.now()) {
  start = now - (UP + (1 - UP) / 2) * DAY_MS;
}
newDay();

export function sunAt(now: number): Sun {
  // Reduced motion holds the sun still, mid-morning.
  const t = reduced ? UP * 0.3 : ((((now - start) / DAY_MS) % 1) + 1) % 1;
  if (t < UP) {
    const a = (t / UP) * Math.PI;
    const y = Math.sin(a);
    return {
      x: -Math.cos(a),
      y,
      light: lightAt(y),
      warmth: 1 - smoothstep(0, 0.5, y),
      glow: 1 - smoothstep(0, 0.35, y),
      dusk: 0,
    };
  }
  // Below the horizon it dips out of sight on the right and comes back on the left.
  const v = (t - UP) / (1 - UP);
  const dusk = Math.sin(v * Math.PI);
  const y = -0.3 * dusk;
  return { x: v < 0.5 ? 1 : -1, y, light: lightAt(y), warmth: 1, glow: 1 - dusk, dusk };
}

// Toward the sun from the astronaut, in its scene. It's in front, on the viewer's side,
// which is how it gets into the visor: low on the left at sunrise, high overhead at noon,
// low on the right at sunset, the same as it crosses the page.
export function towardSun(s: Sun, out: Vector3) {
  return out.set(s.x * 6, 0.6 + 5.4 * Math.max(0, s.y), 5);
}
