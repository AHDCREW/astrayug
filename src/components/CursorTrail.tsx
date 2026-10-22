import { useState } from 'react';
import { lowEnd, maxDpr } from '../lib/device';
import PixelTrail from './reactbits/PixelTrail/PixelTrail';

// Saffron pixels that trail the pointer and fade away, drawn behind the page
// content. They follow a mouse or trackpad, and a finger dragged across a touch
// screen. Skipped entirely for reduced motion.
//
// It's a full-viewport canvas, so its cost scales with the pixel ratio. The pixels are
// big enough that rendering above 1.5x is wasted. Low-end devices render at 1x,
// interpolate fewer points, and drop the peach colour ramp, which costs a second
// canvas redraw and texture upload every frame.
export default function CursorTrail() {
  const [enabled] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0">
      <PixelTrail
        gridSize={72}
        trailSize={0.035}
        maxAge={420}
        interpolate={lowEnd ? 2 : 5}
        dpr={lowEnd ? 1 : Math.min(maxDpr, 1.5)}
        gooeyFilter={false}
        color="#ff5b1f"
        trailColor={lowEnd ? undefined : '#ffc9b0'}
        decay="fade"
        gap={0.14}
        shine={0.25}
        glow={0.15}
      />
    </div>
  );
}
