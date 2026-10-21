import { useState } from 'react';
import PixelTrail from './reactbits/PixelTrail/PixelTrail';

// Saffron pixels that trail the pointer and fade away, drawn behind the page
// content. Mouse and trackpad only, and skipped entirely for reduced motion.
export default function CursorTrail() {
  const [enabled] = useState(
    () =>
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0">
      <PixelTrail
        gridSize={72}
        trailSize={0.035}
        maxAge={420}
        gooeyFilter={false}
        color="#ff5b1f"
        trailColor="#ffc9b0"
        decay="fade"
        gap={0.14}
        shine={0.25}
        glow={0.15}
      />
    </div>
  );
}
