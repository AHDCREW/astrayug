import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Astronaut from './Astronaut';
import { useMascotBrain } from './useMascotBrain';

// The canvas is small, so it can afford the screen's own pixel ratio: 3x on most phones,
// where 2x looks soft.
const MAX_DPR = Math.min(window.devicePixelRatio || 1, 3);

// The astronaut's head peeking up from the bottom of the screen, in the middle. Loaded
// lazily so the countdown paints first. Events come from #root, so the canvas itself
// never blocks clicks on the page around it.
//
// Quality follows the device's real frame rate. It starts at full quality everywhere,
// since the canvas is small. The pixel ratio steps down when frames drop and back up
// when there's headroom. If frames still drop at 1x, it switches for good to the lite
// path, which uses cheaper materials and no studio reflections.
export default function MascotCanvas() {
  const { brain, boop, hover } = useMascotBrain();
  const wrap = useRef<HTMLDivElement>(null);
  const [dpr, setDpr] = useState(MAX_DPR);
  const [lite, setLite] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  // Whether the last step down already landed on 1x.
  const atFloor = useRef(false);

  // Pixel ratio for the monitor's quality factor (0..1), in quarter steps.
  const fit = ({ factor }: { factor: number }) => setDpr(Math.round((1 + (MAX_DPR - 1) * factor) * 4) / 4);

  // Don't render frames nobody can see.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    // Centred under the countdown, and just wide enough for the head.
    <div className="flex h-full justify-center">
      <div ref={wrap} data-quality={lite ? 'lite' : 'full'} className="relative aspect-[5/4] h-full max-w-full">
        <Canvas
          aria-hidden="true"
          frameloop={onScreen ? 'always' : 'never'}
          eventSource={document.getElementById('root') ?? undefined}
          // Events arrive from #root, so measure the pointer against the canvas's real position.
          onCreated={({ gl, setEvents }) =>
            setEvents({
              compute: (event, state) => {
                const r = gl.domElement.getBoundingClientRect();
                state.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
                state.raycaster.setFromCamera(state.pointer, state.camera);
              },
            })
          }
          dpr={dpr}
          camera={{ position: [0, 0, 7], fov: 24 }}
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.NeutralToneMapping,
          }}
        >
          {/* Samples the frame rate in ~1.5 s windows and moves the pixel ratio a quarter
            of the way per step. Three things shape this:
            - Slow is judged against the screen's own top frame rate, not drei's fixed 40
              fps. A phone in low power mode runs at 30 fps however light the scene is, and
              would otherwise be stepped all the way down to the lite path.
            - drei's flip-flop fallback isn't used. It counts every step, even a steady 60
              fps device nudging up against the ceiling, so it would push healthy devices
              onto the lite path.
            - The ratio is set on every step, not in onChange. onChange misses the last step
              down to 0 once the monitor has re-rendered, which leaves the ratio above 1x. */}
          <PerformanceMonitor
            factor={1}
            iterations={6}
            step={0.25}
            bounds={rate => [Math.min(rate * 0.75, 45), rate * 0.9]}
            onIncline={fit}
            onDecline={api => {
              fit(api);
              if (api.factor === 0 && atFloor.current) setLite(true);
              atFloor.current = api.factor === 0;
            }}
          />
          {/* Without reflections the lite path needs more fill light to stay bright. */}
          <hemisphereLight args={['#ffffff', '#e8e1d4', lite ? 2 : 1.1]} />
          <directionalLight position={[3, 4, 5]} intensity={1.5} />
          <directionalLight position={[-4, 2, -3]} intensity={0.7} />
          {/* Soft studio reflections, built locally so nothing is fetched from a CDN. */}
          {!lite && (
            <Environment resolution={256} frames={1}>
              <Lightformer form="rect" intensity={2} position={[0, 5, -4]} scale={[10, 4, 1]} />
              <Lightformer form="rect" intensity={1.4} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
              <Lightformer form="rect" intensity={1} position={[5, 0, 3]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
              <Lightformer form="circle" intensity={3} position={[-3, 4, 5]} scale={1.5} />
            </Environment>
          )}
          <Astronaut brain={brain} onBoop={boop} onHover={hover} lite={lite} />
        </Canvas>
        <button
          type="button"
          onClick={boop}
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:bottom-4 focus-visible:left-1/2 focus-visible:-translate-x-1/2 focus-visible:rounded-full focus-visible:bg-ink focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:text-paper"
        >
          Boop the astronaut
        </button>
      </div>
    </div>
  );
}
