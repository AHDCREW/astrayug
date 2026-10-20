import { useCallback, useEffect, useRef } from 'react';

// Everything the astronaut "knows" about the page. Written by DOM listeners,
// read every frame by <Astronaut>, so it lives in a ref rather than state.
export interface Brain {
  pointer: { x: number; y: number };
  lastMove: number;
  hoverUi: boolean;
  hoverMascot: boolean;
  blinks: [number, number];
  boopAt: number;
  reduced: boolean;
  wander: { x: number; y: number; until: number };
}

const IDLE_AFTER = 3500;
const BLINK_MS = 130;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function useMascotBrain() {
  const brain = useRef<Brain>({
    pointer: { x: 0, y: 0 },
    lastMove: -Infinity,
    hoverUi: false,
    hoverMascot: false,
    blinks: [-Infinity, -Infinity],
    boopAt: -Infinity,
    reduced: false,
    wander: { x: 0, y: 0, until: 0 },
  });

  useEffect(() => {
    const b = brain.current;
    b.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onMove = (e: PointerEvent) => {
      b.pointer.x = e.clientX;
      b.pointer.y = e.clientY;
      b.lastMove = performance.now();
    };
    const onOver = (e: PointerEvent) => {
      b.hoverUi = !!(e.target as Element | null)?.closest?.('a, button, [data-cheer]');
    };

    // Blink every 2.2–6 s, with the occasional double blink.
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        const now = performance.now();
        b.blinks = [now, Math.random() < 0.25 ? now + 2 * BLINK_MS : -Infinity];
        schedule();
      }, 2200 + Math.random() * 3800);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    document.addEventListener('pointerover', onOver);
    schedule();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.removeEventListener('pointerover', onOver);
    };
  }, []);

  const boop = useCallback(() => {
    brain.current.boopAt = performance.now();
  }, []);

  const hover = useCallback((on: boolean) => {
    brain.current.hoverMascot = on;
    document.body.style.cursor = on ? 'pointer' : '';
  }, []);

  return { brain, boop, hover };
}

export const isBlinking = (b: Brain, now: number) => b.blinks.some(t => now >= t && now < t + BLINK_MS);

export const isCheering = (b: Brain) => b.hoverUi || b.hoverMascot;

// Where to look, in -1..1 screen space relative to the head (y grows downward),
// plus how close the cursor is (0..1). Wanders on its own once the cursor rests.
export function lookTarget(b: Brain, head: { x: number; y: number }, now: number) {
  if (now - b.lastMove > IDLE_AFTER && !b.reduced) {
    if (now > b.wander.until) {
      b.wander = { x: Math.random() * 1.4 - 0.7, y: Math.random() * 0.8 - 0.6, until: now + 1400 + Math.random() * 2200 };
    }
    return { x: b.wander.x, y: b.wander.y, near: 0 };
  }
  const dx = b.pointer.x - head.x;
  const dy = b.pointer.y - head.y;
  return {
    x: clamp(dx / (window.innerWidth * 0.45), -1, 1),
    y: clamp(dy / (window.innerHeight * 0.6), -1, 1),
    near: clamp(1 - Math.hypot(dx, dy) / 560, 0, 1),
  };
}
