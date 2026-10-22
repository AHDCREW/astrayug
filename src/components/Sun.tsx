import { useLayoutEffect, useRef } from 'react';
import { lowEnd } from '../lib/device';
import { newDay, sunAt } from '../lib/sun';
import { useTheme } from '../lib/theme';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Light mode's sky, behind the whole page: the sun crossing it (see lib/sun.ts), the
// glow it leaves along the horizon as it rises and sets, the warm wash of golden hour
// and the cool one of twilight. The sun also casts the title's shadow (.sunlit in
// index.css): long and soft when it's low, short and crisp when it's high, and always
// pointing away from it.
//
// This sets the sun's position and how warm, glowing and dusky the light is, and
// index.css turns those into the sky. The sky only moves by transform and opacity, which
// the compositor handles without repainting. The title's shadow does repaint, so
// low-end devices go without it.
export default function Sun() {
  const { theme } = useTheme();
  const sky = useRef<HTMLDivElement>(null);

  // A layout effect, so the sky is in place before the first light-mode frame paints.
  useLayoutEffect(() => {
    const el = sky.current;
    if (theme !== 'light' || !el) return;
    const root = document.documentElement;
    let w = 0;
    let h = 0;
    const measure = () => {
      w = el.clientWidth;
      h = el.clientHeight;
    };

    const paint = (now: number) => {
      const s = sunAt(now);
      const m = Math.min(w, h);
      // The horizon is just below the bottom of the screen, and the arc tops out near
      // the top. At either end the sun is just past the edge, so it rises out of the
      // corner.
      const horizon = h + 0.02 * m;
      const x = w / 2 + s.x * (w / 2 + 0.02 * m);
      const y = horizon - s.y * (horizon - 0.14 * h);
      el.style.setProperty('--sun-x', `${x.toFixed(1)}px`);
      el.style.setProperty('--sun-y', `${y.toFixed(1)}px`);
      el.style.setProperty('--horizon', `${horizon.toFixed(1)}px`);
      el.style.setProperty('--warmth', s.warmth.toFixed(3));
      el.style.setProperty('--glow', s.glow.toFixed(3));
      el.style.setProperty('--dusk', s.dusk.toFixed(3));
      if (lowEnd) return;
      // Away from the sun, as seen from about where the title sits. The skylight fills
      // it in, so it's cool, and fainter when the sun is low and weak.
      const dx = w / 2 - x;
      const dy = h * 0.3 - y;
      const d = Math.hypot(dx, dy) || 1;
      const len = 0.02 + 0.1 * (1 - Math.max(0, s.y)) ** 2;
      const blur = 0.01 + len * 0.4;
      const alpha = 0.15 * s.light * (1 - 0.6 * s.warmth);
      root.style.setProperty(
        '--sun-shadow',
        `${((dx / d) * len).toFixed(3)}em ${((dy / d) * len).toFixed(3)}em ${blur.toFixed(3)}em rgb(30 36 70 / ${alpha.toFixed(3)})`,
      );
    };

    measure();
    // Each time light mode comes on, the day starts again just before dawn.
    newDay();
    paint(performance.now());
    let raf = 0;
    const frame = (now: number) => {
      paint(now);
      raf = requestAnimationFrame(frame);
    };
    if (!reduced) raf = requestAnimationFrame(frame);
    const onResize = () => {
      measure();
      paint(performance.now());
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      root.style.removeProperty('--sun-shadow');
    };
  }, [theme]);

  return (
    <div ref={sky} aria-hidden="true" className="sky">
      <div className="sky-golden" />
      <div className="sky-dusk" />
      <div className="sky-glow" />
      <div className="sun">
        <div className="sun-halo" />
        <div className="sun-halo low" />
        <div className="sun-disc" />
        <div className="sun-disc low" />
      </div>
    </div>
  );
}
