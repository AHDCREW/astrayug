import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { isBlinking, isCheering, lookTarget, type Brain } from './useMascotBrain';

const SHELL = '#F6F4EE';
const SAFFRON = '#FF5B1F';
const FACE = '#F6B4A6';
const EYE = '#1D1B4F';
const MOUTH = '#2B1B2E';
const RING = '#E3DFD5';

// Face ellipsoid behind the visor: centre and radii. Features sit on its surface.
const FC = { y: -0.06, z: 0.6 };
const FR = { x: 0.68, y: 0.56, z: 0.44 };
const faceZ = (x: number, y: number) =>
  FC.z + FR.z * Math.sqrt(Math.max(0, 1 - (x / FR.x) ** 2 - ((y - FC.y) / FR.y) ** 2));

const EYE_X = 0.26;
const EYE_Y = 0.04;
const BLUSH_X = 0.4;
const BLUSH_Y = -0.13;

const REST_Y = -0.35;

function blushTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,111,142,0.9)');
  g.addColorStop(1, 'rgba(255,111,142,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface AstronautProps {
  brain: RefObject<Brain>;
  onBoop: () => void;
  onHover: (on: boolean) => void;
}

export default function Astronaut({ brain, onBoop, onHover }: AstronautProps) {
  const rig = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const eyes = useRef<THREE.Group>(null!);
  const eyeL = useRef<THREE.Group>(null!);
  const eyeR = useRef<THREE.Group>(null!);
  const smile = useRef<THREE.Mesh>(null!);
  const grin = useRef<THREE.Mesh>(null!);
  const antenna = useRef<THREE.Group>(null!);
  const cur = useRef({ x: 0, y: 0, rise: 0, grin: 0 });
  const anchor = useMemo(() => new THREE.Vector3(), []);

  const mats = useMemo(
    () => ({
      shell: new THREE.MeshPhysicalMaterial({ color: SHELL, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.25 }),
      trim: new THREE.MeshPhysicalMaterial({ color: SAFFRON, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
      face: new THREE.MeshPhysicalMaterial({
        color: FACE,
        roughness: 0.5,
        clearcoat: 1,
        clearcoatRoughness: 0.2,
        sheen: 0.5,
        sheenColor: new THREE.Color('#ffd9df'),
      }),
      eye: new THREE.MeshPhysicalMaterial({ color: EYE, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 }),
      shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      mouth: new THREE.MeshStandardMaterial({ color: MOUTH, roughness: 0.6, side: THREE.DoubleSide }),
      ring: new THREE.MeshPhysicalMaterial({ color: RING, roughness: 0.5, clearcoat: 0.5 }),
      blush: new THREE.MeshBasicMaterial({ map: blushTexture(), transparent: true, depthWrite: false, opacity: 0.6 }),
      glint: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }),
    }),
    [],
  );

  useEffect(
    () => () => {
      mats.blush.map?.dispose();
      Object.values(mats).forEach(m => m.dispose());
    },
    [mats],
  );

  useFrame(({ camera, gl, clock }, dt) => {
    const b = brain.current;
    const now = performance.now();

    // Project the head centre to screen space so tracking is relative to where it really is.
    const rect = gl.domElement.getBoundingClientRect();
    head.current.getWorldPosition(anchor).project(camera);
    const screen = {
      x: rect.left + ((anchor.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - anchor.y) / 2) * rect.height,
    };

    const look = lookTarget(b, screen, now);
    const cheer = isCheering(b);
    const lambda = b.reduced ? 1000 : 6;
    const c = cur.current;
    c.x = THREE.MathUtils.damp(c.x, look.x, lambda, dt);
    c.y = THREE.MathUtils.damp(c.y, look.y, lambda, dt);
    c.rise = THREE.MathUtils.damp(c.rise, Math.min(1, look.near * 0.6 + (cheer ? 0.5 : 0)), lambda * 0.7, dt);
    c.grin = THREE.MathUtils.damp(c.grin, cheer ? 1 : 0, lambda * 2, dt);

    head.current.rotation.set(c.y * 0.3, c.x * 0.5, -c.x * 0.06);
    body.current.rotation.y = c.x * 0.15;
    eyes.current.position.set(c.x * 0.05, -c.y * 0.035, 0);

    // Blink, and squint a little while grinning.
    const open = isBlinking(b, now) ? 0.08 : 1 - c.grin * 0.25;
    eyeL.current.scale.y = eyeR.current.scale.y = THREE.MathUtils.damp(eyeL.current.scale.y, open, 40, dt);

    smile.current.visible = c.grin < 0.5;
    grin.current.visible = c.grin >= 0.5;
    grin.current.scale.y = Math.max(0.01, c.grin);

    // Boop: a quick hop with squash and stretch, settling in under a second.
    const t = (now - b.boopAt) / 1000;
    let hop = 0;
    let squash = 0;
    if (t >= 0 && t < 0.9 && !b.reduced) {
      hop = t < 0.45 ? Math.sin((t / 0.45) * Math.PI) * 0.28 : 0;
      squash = Math.exp(-t * 7) * Math.sin(t * 22) * 0.1;
    }
    rig.current.position.y = REST_Y + c.rise * 0.32 + hop;
    rig.current.scale.set(1 - squash * 0.6, 1 + squash, 1 - squash * 0.6);

    antenna.current.rotation.z = -0.35 + (b.reduced ? 0 : Math.sin(clock.elapsedTime * 2.2) * 0.07);
  });

  const eyeZ = faceZ(EYE_X, EYE_Y) - 0.025;
  const blushZ = faceZ(BLUSH_X, BLUSH_Y) + 0.01;
  const mouthZ = faceZ(0, -0.2) + 0.006;

  return (
    <group
      ref={rig}
      position={[0, REST_Y, 0]}
      onClick={e => {
        e.stopPropagation();
        onBoop();
      }}
      onPointerOver={e => {
        e.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
    >
      {/* torso */}
      <group ref={body}>
        <mesh position={[0, -1.55, 0]} scale={[1.35, 1, 0.9]} material={mats.shell}>
          <capsuleGeometry args={[0.62, 0.5, 12, 48]} />
        </mesh>
        <mesh position={[0, -0.93, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.ring}>
          <torusGeometry args={[0.5, 0.09, 24, 64]} />
        </mesh>
        <RoundedBox args={[0.34, 0.2, 0.08]} radius={0.03} position={[-0.36, -1.32, 0.5]} rotation={[0, -0.45, 0]} material={mats.trim} />
      </group>

      <group ref={head}>
        {/* helmet shell, visor gasket, face */}
        <mesh scale={[1, 0.95, 0.97]} material={mats.shell}>
          <sphereGeometry args={[1, 96, 96]} />
        </mesh>
        <mesh position={[0, FC.y, FC.z - 0.03]} scale={[FR.x + 0.035, FR.y + 0.035, FR.z]} material={mats.ring}>
          <sphereGeometry args={[1, 64, 64]} />
        </mesh>
        <mesh position={[0, FC.y, FC.z]} scale={[FR.x, FR.y, FR.z]} material={mats.face}>
          <sphereGeometry args={[1, 64, 64]} />
        </mesh>

        {/* ear caps and antenna */}
        {[-1, 1].map(side => (
          <mesh key={side} position={[side * 0.97, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.trim}>
            <cylinderGeometry args={[0.2, 0.2, 0.16, 48]} />
          </mesh>
        ))}
        <group ref={antenna} position={[1.02, 0.12, 0]} rotation={[0, 0, -0.35]}>
          <mesh position={[0, 0.21, 0]} material={mats.ring}>
            <cylinderGeometry args={[0.018, 0.018, 0.42, 12]} />
          </mesh>
          <mesh position={[0, 0.45, 0]} material={mats.trim}>
            <sphereGeometry args={[0.065, 32, 32]} />
          </mesh>
        </group>

        {/* eyes follow the cursor a little further than the head turns */}
        <group ref={eyes}>
          {[
            { ref: eyeL, x: -EYE_X },
            { ref: eyeR, x: EYE_X },
          ].map(({ ref, x }) => (
            <group key={x} ref={ref} position={[x, EYE_Y, eyeZ]}>
              <mesh scale={[1, 1.18, 0.55]} material={mats.eye}>
                <sphereGeometry args={[0.155, 48, 48]} />
              </mesh>
              <mesh position={[-0.054, 0.072, 0.082]} material={mats.shine}>
                <sphereGeometry args={[0.043, 24, 24]} />
              </mesh>
              <mesh position={[0.054, -0.06, 0.074]} material={mats.shine}>
                <sphereGeometry args={[0.02, 16, 16]} />
              </mesh>
            </group>
          ))}
        </group>

        {/* blush */}
        {[-1, 1].map(side => (
          <mesh key={side} position={[side * BLUSH_X, BLUSH_Y, blushZ]} rotation={[0.1, side * 0.44, 0]} material={mats.blush}>
            <planeGeometry args={[0.3, 0.19]} />
          </mesh>
        ))}

        {/* mouth: a small smile, swapped for an open grin on hover */}
        <mesh ref={smile} position={[0, -0.18, mouthZ]} rotation={[0.22, 0, Math.PI]} material={mats.mouth}>
          <torusGeometry args={[0.07, 0.017, 12, 32, Math.PI]} />
        </mesh>
        <mesh ref={grin} position={[0, -0.17, mouthZ + 0.004]} rotation={[0.22, 0, 0]} material={mats.mouth} visible={false}>
          <circleGeometry args={[0.095, 32, Math.PI, Math.PI]} />
        </mesh>

        {/* visor glint */}
        <mesh position={[0, FC.y, faceZ(-0.24, 0.2) + 0.04]} rotation={[0, 0, 1.95]} material={mats.glint}>
          <torusGeometry args={[0.38, 0.02, 8, 48, 0.75]} />
        </mesh>
      </group>
    </group>
  );
}
