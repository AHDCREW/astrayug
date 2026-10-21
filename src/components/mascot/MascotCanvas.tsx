import { Environment, Lightformer } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import Astronaut from './Astronaut';
import { useMascotBrain } from './useMascotBrain';

// The astronaut floating in zero-g below the countdown, tethered from off-screen.
// Loaded lazily so the countdown paints first. Events come from #root, so the
// canvas itself never blocks clicks on the page around it.
export default function MascotCanvas() {
  const { brain, boop, hover } = useMascotBrain();

  return (
    <div className="relative mx-auto h-full w-full max-w-[760px]">
      <Canvas
        aria-hidden="true"
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
        dpr={[1, 2]}
        camera={{ position: [0, 0, 7], fov: 24 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
      >
        <hemisphereLight args={['#ffffff', '#e8e1d4', 1.1]} />
        <directionalLight position={[3, 4, 5]} intensity={1.5} />
        <directionalLight position={[-4, 2, -3]} intensity={0.7} />
        {/* Soft studio reflections, built locally so nothing is fetched from a CDN. */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2} position={[0, 5, -4]} scale={[10, 4, 1]} />
          <Lightformer form="rect" intensity={1.4} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={1} position={[5, 0, 3]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
          <Lightformer form="circle" intensity={3} position={[-3, 4, 5]} scale={1.5} />
        </Environment>
        <Astronaut brain={brain} onBoop={boop} onHover={hover} />
      </Canvas>
      <button
        type="button"
        onClick={boop}
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:bottom-4 focus-visible:left-1/2 focus-visible:-translate-x-1/2 focus-visible:rounded-full focus-visible:bg-ink focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:text-paper"
      >
        Boop the astronaut
      </button>
    </div>
  );
}
