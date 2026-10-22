import type { Vector3 } from 'three';

// The sky's clock: a day and a night, fifteen seconds each, on a loop. By day the page is
// in light mode, and the sun rises at its bottom left, arcs over it and sets at the
// bottom right. At sunset it turns to dark mode, and the full moon rises at the bottom
// left, opposite the setting sun as a full moon does. It crosses the same way and sets
// at the bottom right as the sun comes up again. Around each turn the horizon glows: the
// afterglow on the right after sunset, and dawn on the left before sunrise.
//
// The theme (lib/theme.tsx), the page's sky (components/Sky.tsx) and the astronaut's
// light all read it from here, so they stay in step. The theme toggle skips ahead to the
// next sunset or sunrise. Reduced motion stops the clock, so the sun or moon holds
// still and the theme only changes with the toggle.

export const DAY_MS = 15000;
export const NIGHT_MS = 15000;
const CYCLE = DAY_MS + NIGHT_MS;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// How far the sun and moon sink below the horizon at the ends of their arcs, so they've
// set completely by the time the theme turns.
const BELOW = 0.08;

export interface Body {
  // Across the sky: -1 on the left horizon, 1 on the right.
  x: number;
  // Up the sky: 0 on the horizon, 1 at the top of the arc, below 0 once it's set.
  y: number;
  // Its direct light: none once it's down, full once it's clear of the horizon.
  light: number;
  // How low and red it is: 1 on the horizon, 0 once it's well up.
  warmth: number;
}

export interface Sky {
  night: boolean;
  sun: Body;
  moon: Body;
  // How much of the daylight has gone: none with the sun up, all of it once it's set.
  dark: number;
  // The glow along the horizon, and its side (-1 left, 1 right). By day it's round the
  // sun while the sun is low. By night it's the afterglow, then the dawn.
  glow: number;
  glowX: number;
  // How much twilight is left in the night sky: 1 at dusk and dawn, 0 in the dead of
  // night. Always 0 by day.
  twilight: number;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The sun or moon along its arc, `u` running from 0 as it rises to 1 as it sets.
function arc(u: number): Body {
  const a = u * Math.PI;
  const y = Math.sin(a) * (1 + BELOW) - BELOW;
  return { x: -Math.cos(a), y, light: smoothstep(-0.04, 0.12, y), warmth: 1 - smoothstep(0, 0.5, y) };
}
const DOWN: Body = { x: 0, y: -1, light: 0, warmth: 1 };

let start = 0;
// Where the clock stands with reduced motion.
let held = 0;

// Sets the clock to sunrise, or with `night` to sunset. With reduced motion it holds the
// sun mid-morning, or the moon high in the night.
export function startHalf(night: boolean, now = performance.now()) {
  start = now - (night ? DAY_MS : 0);
  held = night ? DAY_MS + NIGHT_MS * 0.4 : DAY_MS * 0.3;
}
// index.html has already picked the theme, and the sky starts from its sunrise or sunset.
startHalf(document.documentElement.classList.contains('dark'));

const phase = (now: number) => (reduced ? held : (((now - start) % CYCLE) + CYCLE) % CYCLE);

export const nightAt = (now: number) => phase(now) >= DAY_MS;

// Time until the next sunset or sunrise.
export function msToTurn(now: number) {
  const t = phase(now);
  return t < DAY_MS ? DAY_MS - t : CYCLE - t;
}

export function skyAt(now: number): Sky {
  const t = phase(now);
  if (t < DAY_MS) {
    const sun = arc(t / DAY_MS);
    return {
      night: false,
      sun,
      moon: DOWN,
      dark: 1 - smoothstep(-BELOW, 0.15, sun.y),
      glow: 1 - smoothstep(0, 0.35, sun.y),
      glowX: sun.x,
      twilight: 0,
    };
  }
  const u = (t - DAY_MS) / NIGHT_MS;
  return {
    night: true,
    sun: DOWN,
    moon: arc(u),
    dark: 1,
    glow: Math.max(1 - smoothstep(0, 0.2, u), smoothstep(0.8, 1, u)),
    glowX: u < 0.5 ? 1 : -1,
    twilight: Math.max(1 - smoothstep(0, 0.35, u), smoothstep(0.65, 1, u)),
  };
}

// Toward the sun or moon from the astronaut, in its scene. It's in front, on the viewer's
// side, which is how it gets into the visor: low on the left as it rises, high overhead
// halfway, low on the right as it sets, the same as it crosses the page.
export function toward(body: Body, out: Vector3) {
  return out.set(body.x * 6, 0.6 + 5.4 * Math.max(0, body.y), 5);
}
