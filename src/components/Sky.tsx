import { useLayoutEffect, useRef, useState } from 'react';
import { lowEnd } from '../lib/device';
import { skyAt, type Body } from '../lib/sky';
import { useTheme } from '../lib/theme';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Stars for the night sky, as box shadows on one dot, so a whole field is one element.
// They thin out toward the horizon, where there's more air to see them through.
function starField(count: number) {
  return Array.from({ length: count }, () => {
    const x = Math.random() * 100;
    const y = Math.random() ** 1.4 * 85;
    const alpha = (0.25 + Math.random() * 0.55) * (1 - y / 110);
    const size = Math.random() < 0.15 ? 1 : 0.5;
    return `${x.toFixed(2)}vw ${y.toFixed(2)}vh 0 ${size}px rgb(236 240 255 / ${alpha.toFixed(2)})`;
  }).join(',');
}

// The sky behind the whole page, on the sky's clock (see lib/sky.ts). By day: the sun,
// the glow it makes along the horizon as it rises and sets, and the warm wash of golden
// hour. The sun also casts the title's shadow (.sunlit in index.css): long and soft when
// it's low, short and crisp when it's high, and always pointing away from it. By night:
// the full moon, the stars, the afterglow and the dawn, and the deep blue of twilight
// either side of them.
//
// This sets where the sun and moon are and how the light is, and index.css turns those
// into the sky. Each theme shows only its own half. The sky only moves by transform and
// opacity, which the compositor handles without repainting. The title's shadow does
// repaint, so low-end devices go without it.
export default function Sky() {
  const { theme } = useTheme();
  const sky = useRef<HTMLDivElement>(null);
  const [stars] = useState(() => [starField(45), starField(45)]);

  // A layout effect, so the sky is in place before the first frame paints.
  useLayoutEffect(() => {
    const el = sky.current;
    if (!el) return;
    const root = document.documentElement;
    const shadows = theme === 'light' && !lowEnd;
    let w = 0;
    let h = 0;
    const measure = () => {
      w = el.clientWidth;
      h = el.clientHeight;
    };
    const set = (name: string, value: string) => el.style.setProperty(name, value);

    const paint = (now: number) => {
      const s = skyAt(now);
      const m = Math.min(w, h);
      // The horizon is just below the bottom of the screen, and the arc tops out near
      // the top. At either end the sun or moon is just past the edge, so it rises out of
      // the corner.
      const horizon = h + 0.02 * m;
      const across = (x: number) => w / 2 + x * (w / 2 + 0.02 * m);
      const up = (b: Body) => horizon - b.y * (horizon - 0.14 * h);
      set('--horizon', `${horizon.toFixed(1)}px`);
      set('--sun-x', `${across(s.sun.x).toFixed(1)}px`);
      set('--sun-y', `${up(s.sun).toFixed(1)}px`);
      set('--sun-warmth', s.sun.warmth.toFixed(3));
      set('--moon-x', `${across(s.moon.x).toFixed(1)}px`);
      set('--moon-y', `${up(s.moon).toFixed(1)}px`);
      set('--moon-warmth', s.moon.warmth.toFixed(3));
      // The moon's face turns as it crosses, the way it does seen from the north.
      set('--moon-tilt', `${(s.moon.x * 30).toFixed(1)}deg`);
      set('--glow', s.glow.toFixed(3));
      set('--glow-x', `${across(s.glowX).toFixed(1)}px`);
      set('--twilight', s.twilight.toFixed(3));
      if (!shadows) return;
      // Away from the sun, as seen from about where the title sits. The skylight fills
      // it in, so it's cool, and fainter when the sun is low and weak.
      const dx = w / 2 - across(s.sun.x);
      const dy = h * 0.3 - up(s.sun);
      const d = Math.hypot(dx, dy) || 1;
      const len = 0.02 + 0.1 * (1 - Math.max(0, s.sun.y)) ** 2;
      const blur = 0.01 + len * 0.4;
      const alpha = 0.15 * s.sun.light * (1 - 0.6 * s.sun.warmth);
      root.style.setProperty(
        '--sun-shadow',
        `${((dx / d) * len).toFixed(3)}em ${((dy / d) * len).toFixed(3)}em ${blur.toFixed(3)}em rgb(30 36 70 / ${alpha.toFixed(3)})`,
      );
    };

    measure();
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
      <div className="sky-golden by-day" />
      <div className="sky-twilight by-night" />
      <div className="stars by-night">
        {stars.map((field, k) => (
          <div key={k} style={{ boxShadow: field }} />
        ))}
      </div>
      <div className="sky-glow" />
      <div className="sun by-day">
        <div className="sun-halo" />
        <div className="sun-halo low" />
        <div className="sun-disc" />
        <div className="sun-disc low" />
      </div>
      <div className="moon by-night">
        <div className="moon-halo" />
        <div className="moon-halo low" />
        <div className="moon-disc" />
        <div className="moon-disc low" />
      </div>
    </div>
  );
}
