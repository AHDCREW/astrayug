import { useEffect, useRef, useState } from 'react';

const CLICKABLE = 'a, button, [data-cheer]';

type Point = { x: number; y: number };

// Stands in for the system cursor on mouse and trackpad: a saffron dot pinned to
// the pointer and an ink ring that trails it, swelling over anything clickable.
// Touch screens keep the default.
export default function Cursor() {
  const [enabled] = useState(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  const layerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!layer || !dot || !ring) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const html = document.documentElement;
    const pointer: Point = { x: 0, y: 0 };
    const trail: Point = { x: 0, y: 0 };
    let overUi = false;
    let down = false;
    let raf = 0;
    let last = 0;

    const place = (el: HTMLElement, { x, y }: Point) => {
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const show = (on: boolean) => layer.toggleAttribute('data-shown', on);

    const frame = (now: number) => {
      // Trails at the same speed whatever the refresh rate.
      const dt = last ? Math.min(now - last, 50) : 16;
      last = now;
      const k = reduced ? 1 : 1 - Math.exp(-dt / 60);
      trail.x += (pointer.x - trail.x) * k;
      trail.y += (pointer.y - trail.y) * k;
      const settled = Math.hypot(pointer.x - trail.x, pointer.y - trail.y) < 0.2;
      if (settled) Object.assign(trail, pointer);
      place(ring, trail);
      // The astronaut asks for a pointer through body.style.cursor while it's hovered.
      const hover = overUi || document.body.style.cursor === 'pointer';
      layer.dataset.state = down ? 'down' : hover ? 'hover' : 'idle';
      raf = settled ? 0 : requestAnimationFrame(frame);
    };

    const wake = () => {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        show(false);
        return;
      }
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      place(dot, pointer);
      // Appear in place rather than sliding in from wherever the pointer left.
      if (!layer.hasAttribute('data-shown')) {
        Object.assign(trail, pointer);
        place(ring, trail);
        show(true);
      }
      wake();
    };
    const onOver = (e: PointerEvent) => {
      overUi = !!(e.target as Element | null)?.closest?.(CLICKABLE);
      wake();
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) show(false);
    };
    const onDown = (e: PointerEvent) => {
      down = e.pointerType !== 'touch';
      wake();
    };
    const onUp = () => {
      down = false;
      wake();
    };

    html.classList.add('custom-cursor');
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('blur', onUp);
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    return () => {
      cancelAnimationFrame(raf);
      html.classList.remove('custom-cursor');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', onUp);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      data-state="idle"
      className="group pointer-events-none fixed inset-0 z-100 overflow-hidden opacity-0 transition-opacity duration-200 data-shown:opacity-100"
    >
      <div ref={ringRef} className="absolute top-0 left-0">
        <div className="size-8 -translate-1/2 rounded-full border-[1.5px] border-ink transition-[width,height,background-color,border-color] duration-300 ease-out group-data-[state=down]:size-6 group-data-[state=hover]:size-14 group-data-[state=hover]:bg-saffron/10 motion-reduce:transition-none" />
      </div>
      <div ref={dotRef} className="absolute top-0 left-0">
        <div className="size-2 -translate-1/2 rounded-full bg-saffron transition-[scale] duration-200 group-data-[state=hover]:scale-0 motion-reduce:transition-none" />
      </div>
    </div>
  );
}
