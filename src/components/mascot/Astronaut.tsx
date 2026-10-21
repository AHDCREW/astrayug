import { QuadraticBezierLine, RoundedBox, type QuadraticBezierLineRef } from '@react-three/drei';
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
const METAL = '#3B3B42';
const PUFF = '#FFC9B0';
const TETHER = '#C9C3B6';

// Face ellipsoid behind the visor: centre and radii. Features sit on its surface.
const FC = { y: -0.06, z: 0.6 };
const FR = { x: 0.68, y: 0.56, z: 0.44 };
const faceZ = (x: number, y: number) =>
  FC.z + FR.z * Math.sqrt(Math.max(0, 1 - (x / FR.x) ** 2 - ((y - FC.y) / FR.y) ** 2));

const EYE_X = 0.26;
const EYE_Y = 0.04;
const BLUSH_X = 0.4;
const BLUSH_Y = -0.13;

// The model is built around the helmet's centre. It's scaled down to fit the stage
// and shifted so the rig's origin is the middle of the body, which is what it rolls
// and somersaults around.
const SCALE = 0.52;
const CENTER_Y = 0.86;
const BASE_Y = 0.04;

// Shoulder and hip joints, mirrored by side (-1 is the viewer's left).
const SHOULDER = { x: 0.6, y: -1.12 };
const HIP = { x: 0.27, y: -1.95 };
const NOZZLE = { x: 0.3, y: -1.88, z: -0.58 };
const ARM_REST = 0.6;
const ARM_WAVE = 2.3;

const SPIN_S = 1.1;
const PUFFS = 14;
const SIDES = [-1, 1] as const;

// Placeholder ends for the tether; the real ones are set every frame.
const ORIGIN: [number, number, number] = [0, 0, 0];

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

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

interface Puff {
  age: number;
  life: number;
  size: number;
  vel: THREE.Vector3;
}

interface AstronautProps {
  brain: RefObject<Brain>;
  onBoop: () => void;
  onHover: (on: boolean) => void;
  // Cheaper materials and rounder-by-fewer-polygons spheres, for slower devices.
  lite: boolean;
}

export default function Astronaut({ brain, onBoop, onHover, lite }: AstronautProps) {
  // Segment count for curved geometry: full detail, or about half on the lite path.
  const seg = (n: number) => (lite ? Math.max(12, Math.round(n / 2)) : n);
  const rig = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const eyes = useRef<THREE.Group>(null!);
  const eyeL = useRef<THREE.Group>(null!);
  const eyeR = useRef<THREE.Group>(null!);
  const smile = useRef<THREE.Mesh>(null!);
  const grin = useRef<THREE.Mesh>(null!);
  const antenna = useRef<THREE.Group>(null!);
  const arms = useRef<THREE.Group[]>([]);
  const legs = useRef<THREE.Group[]>([]);
  const nozzles = useRef<THREE.Group[]>([]);
  const puffMeshes = useRef<THREE.Mesh[]>([]);
  const clip = useRef<THREE.Group>(null!);
  const tether = useRef<QuadraticBezierLineRef>(null!);
  const cur = useRef({ x: 0, y: 0, lean: 0, grin: 0, wave: [0, 0], seenBoop: -Infinity, spinAt: -Infinity, nextPuff: 0, nextSlot: 0 });
  const tmp = useMemo(
    () => ({ anchor: new THREE.Vector3(), start: new THREE.Vector3(), end: new THREE.Vector3(), mid: new THREE.Vector3(), q: new THREE.Quaternion() }),
    [],
  );
  const puffs = useRef<Puff[]>(Array.from({ length: PUFFS }, () => ({ age: 1, life: 1, size: 0, vel: new THREE.Vector3() })));
  const puffGeometry = useMemo(() => new THREE.SphereGeometry(1, 16, 12), []);

  const mats = useMemo(() => {
    // Clearcoat and sheen give the glossy toy-plastic look, but they're the most
    // expensive part of the shading. The lite path uses plain standard materials.
    const gloss = (color: string, roughness: number, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
      lite
        ? new THREE.MeshStandardMaterial({ color, roughness, metalness: extra.metalness ?? 0 })
        : new THREE.MeshPhysicalMaterial({ color, roughness, ...extra });
    return {
      shell: gloss(SHELL, 0.4, { clearcoat: 1, clearcoatRoughness: 0.25 }),
      trim: gloss(SAFFRON, 0.38, { clearcoat: 0.6, clearcoatRoughness: 0.3 }),
      face: gloss(FACE, 0.5, { clearcoat: 1, clearcoatRoughness: 0.2, sheen: 0.5, sheenColor: new THREE.Color('#ffd9df') }),
      eye: gloss(EYE, 0.12, { clearcoat: 1, clearcoatRoughness: 0.04 }),
      shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      mouth: new THREE.MeshStandardMaterial({ color: MOUTH, roughness: 0.6, side: THREE.DoubleSide }),
      ring: gloss(RING, 0.5, { clearcoat: 0.5 }),
      metal: gloss(METAL, 0.35, { metalness: 0.6, clearcoat: 0.3 }),
      blush: new THREE.MeshBasicMaterial({ map: blushTexture(), transparent: true, depthWrite: false, opacity: 0.6 }),
      glint: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }),
      puff: new THREE.MeshStandardMaterial({ color: PUFF, roughness: 1, transparent: true, opacity: 0.85, depthWrite: false }),
    };
  }, [lite]);

  useEffect(
    () => () => {
      mats.blush.map?.dispose();
      Object.values(mats).forEach(m => m.dispose());
      puffGeometry.dispose();
    },
    [mats, puffGeometry],
  );

  // Fire one puff of exhaust out of a nozzle, reusing the oldest slot in the pool.
  // Puffs angle outward and back so they clear the legs.
  const emit = (side: number, speed: number) => {
    const nozzle = nozzles.current[side > 0 ? 1 : 0];
    const c = cur.current;
    const slot = c.nextSlot;
    c.nextSlot = (slot + 1) % PUFFS;
    const puff = puffs.current[slot];
    const mesh = puffMeshes.current[slot];
    if (!mesh || !nozzle) return;
    nozzle.getWorldPosition(mesh.position);
    nozzle.getWorldQuaternion(tmp.q);
    puff.vel
      .set(side * (0.55 + Math.random() * 0.3), -1, -0.4 + (Math.random() - 0.5) * 0.3)
      .applyQuaternion(tmp.q)
      .multiplyScalar(speed);
    puff.age = 0;
    puff.life = 0.9 + Math.random() * 0.6;
    puff.size = (0.045 + Math.random() * 0.03) * (speed > 0.6 ? 1.4 : 1);
  };

  useFrame(({ camera, size, clock, viewport }, dt) => {
    const b = brain.current;
    const now = performance.now();
    const t = clock.elapsedTime;
    const c = cur.current;
    // Everything that floats is scaled by this, so reduced motion holds a still pose.
    const float = b.reduced ? 0 : 1;

    // Project the head centre to screen space so tracking is relative to where it really is.
    // `size` is the canvas's on-screen box, which R3F re-measures on resize and scroll,
    // so there's no layout read here every frame.
    head.current.getWorldPosition(tmp.anchor).project(camera);
    const screen = {
      x: size.left + ((tmp.anchor.x + 1) / 2) * size.width,
      y: size.top + ((1 - tmp.anchor.y) / 2) * size.height,
    };

    const look = lookTarget(b, screen, now);
    const cheer = isCheering(b);
    const lambda = b.reduced ? 1000 : 6;
    c.x = THREE.MathUtils.damp(c.x, look.x, lambda, dt);
    c.y = THREE.MathUtils.damp(c.y, look.y, lambda, dt);
    c.lean = THREE.MathUtils.damp(c.lean, look.near, lambda * 0.5, dt);
    c.grin = THREE.MathUtils.damp(c.grin, cheer ? 1 : 0, lambda * 2, dt);
    // Wave with whichever arm is nearer the cursor.
    c.wave[0] = THREE.MathUtils.damp(c.wave[0], cheer && c.x < 0 ? 1 : 0, lambda, dt);
    c.wave[1] = THREE.MathUtils.damp(c.wave[1], cheer && c.x >= 0 ? 1 : 0, lambda, dt);

    // Boop: a cartwheel with a little boost and a burst from the jetpack. A boop
    // mid-spin only adds puffs, so the spin never snaps back to the start.
    if (b.boopAt !== c.seenBoop) {
      c.seenBoop = b.boopAt;
      if (!b.reduced) {
        if (now - c.spinAt > SPIN_S * 1000) c.spinAt = b.boopAt;
        for (let i = 0; i < 6; i++) emit(SIDES[i % 2], 0.9 + Math.random() * 0.4);
      }
    }
    const p = (now - c.spinAt) / (SPIN_S * 1000);
    const spinning = p >= 0 && p < 1;
    const spin = spinning ? easeInOut(p) * Math.PI * 2 : 0;
    const fling = spinning ? Math.sin(p * Math.PI) : 0;

    // Zero-g drift: two out-of-step sines per axis, so the path never quite repeats.
    // It leans a little toward the cursor when it comes close.
    rig.current.position.set(
      float * (Math.sin(t * 0.21) * 0.5 + Math.sin(t * 0.53 + 1) * 0.12) + c.x * c.lean * 0.2,
      BASE_Y + float * (Math.sin(t * 0.29) * 0.12 + Math.sin(t * 0.71 + 2) * 0.04) - c.y * c.lean * 0.12 + fling * 0.25,
      0,
    );
    rig.current.rotation.set(float * Math.sin(t * 0.23) * 0.08, 0, float * Math.sin(t * 0.17) * 0.2 - spin);

    head.current.rotation.set(c.y * 0.3, c.x * 0.5, -c.x * 0.06);
    body.current.rotation.y = c.x * 0.15;
    eyes.current.position.set(c.x * 0.05, -c.y * 0.035, 0);

    // Arms drift like they're treading water, fling out mid-cartwheel, and wave on cheer.
    arms.current.forEach((arm, i) => {
      const side = SIDES[i];
      const wave = c.wave[i];
      const sway = float * Math.sin(t * 1.3 + i * 1.7) * 0.18 + fling * 0.9;
      const flap = float * Math.sin(t * 9) * 0.35;
      arm.rotation.z = side * (ARM_REST + sway + wave * (ARM_WAVE - ARM_REST + flap));
      arm.rotation.x = float * Math.sin(t * 0.9 + i) * 0.15;
    });
    // Legs kick slowly out of step.
    legs.current.forEach((leg, i) => {
      leg.rotation.x = float * Math.sin(t * 1.1 + i * Math.PI) * 0.28;
      leg.rotation.z = SIDES[i] * (0.12 + float * Math.sin(t * 0.8 + i) * 0.05 + fling * 0.3);
    });

    // Blink, and squint a little while grinning.
    const open = isBlinking(b, now) ? 0.08 : 1 - c.grin * 0.25;
    eyeL.current.scale.y = eyeR.current.scale.y = THREE.MathUtils.damp(eyeL.current.scale.y, open, 40, dt);

    smile.current.visible = c.grin < 0.5;
    grin.current.visible = c.grin >= 0.5;
    grin.current.scale.y = Math.max(0.01, c.grin);

    antenna.current.rotation.z = -0.35 + float * Math.sin(t * 2.2) * 0.07;

    // A gentle idle trickle from the jetpack. Puffs live in world space, so they
    // hang where they were fired while the astronaut drifts on.
    if (!b.reduced && now > c.nextPuff) {
      emit(Math.random() < 0.5 ? -1 : 1, 0.4 + Math.random() * 0.15);
      c.nextPuff = now + 260 + Math.random() * 420;
    }
    puffs.current.forEach((puff, i) => {
      const mesh = puffMeshes.current[i];
      if (!mesh) return;
      mesh.visible = puff.age < puff.life;
      if (!mesh.visible) return;
      puff.age += dt;
      const k = Math.min(1, puff.age / puff.life);
      mesh.position.addScaledVector(puff.vel, dt);
      puff.vel.multiplyScalar(Math.exp(-dt * 1.2));
      mesh.scale.setScalar(Math.max(0.001, puff.size * (0.6 + k * 1.6) * (1 - k * k)));
    });

    // The tether runs in from off-screen bottom left and goes slack toward the pack.
    clip.current.getWorldPosition(tmp.end);
    tmp.start.set(-viewport.width / 2 - 0.4, -viewport.height / 2 - 0.4, -0.6);
    tmp.mid.set(
      THREE.MathUtils.lerp(tmp.start.x, tmp.end.x, 0.65),
      THREE.MathUtils.lerp(tmp.start.y, tmp.end.y, 0.15) + float * Math.sin(t * 0.8) * 0.06,
      (tmp.start.z + tmp.end.z) / 2,
    );
    tether.current.setPoints(tmp.start, tmp.end, tmp.mid);
  });

  const eyeZ = faceZ(EYE_X, EYE_Y) - 0.025;
  const blushZ = faceZ(BLUSH_X, BLUSH_Y) + 0.01;
  const mouthZ = faceZ(0, -0.2) + 0.006;

  return (
    <>
      <group
        ref={rig}
        position={[0, BASE_Y, 0]}
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
        <group scale={SCALE} position={[0, CENTER_Y * SCALE, 0]}>
          <group ref={body}>
            {/* torso, neck ring, chest panel */}
            <mesh position={[0, -1.42, 0]} scale={[1.25, 1, 0.95]} material={mats.shell}>
              <capsuleGeometry args={[0.5, 0.35, 12, seg(40)]} />
            </mesh>
            <mesh position={[0, -0.9, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.ring}>
              <torusGeometry args={[0.46, 0.085, 20, seg(56)]} />
            </mesh>
            <RoundedBox args={[0.5, 0.3, 0.1]} radius={0.04} position={[0, -1.38, 0.43]} material={mats.trim} />
            {[mats.shine, mats.eye, mats.shine].map((m, i) => (
              <mesh key={i} position={[(i - 1) * 0.13, -1.38, 0.485]} material={m}>
                <sphereGeometry args={[0.035, 16, 16]} />
              </mesh>
            ))}

            {/* jetpack with a saffron band, two nozzles and a clip for the tether */}
            <RoundedBox args={[1.4, 1.05, 0.45]} radius={0.14} position={[0, -1.35, -0.55]} material={mats.shell} />
            <RoundedBox args={[1.42, 0.12, 0.47]} radius={0.05} position={[0, -1.1, -0.55]} material={mats.trim} />
            {SIDES.map((side, i) => (
              <group key={side} position={[side * NOZZLE.x, NOZZLE.y, NOZZLE.z]}>
                <mesh material={mats.metal}>
                  <cylinderGeometry args={[0.07, 0.11, 0.14, 20]} />
                </mesh>
                <group
                  ref={g => {
                    if (g) nozzles.current[i] = g;
                  }}
                  position={[0, -0.08, 0]}
                />
              </group>
            ))}
            <group ref={clip} position={[-0.7, -1.5, -0.55]} />

            {/* arms: upper arm, saffron cuff, glove, hanging from a shoulder pivot */}
            {SIDES.map((side, i) => (
              <group
                key={side}
                ref={g => {
                  if (g) arms.current[i] = g;
                }}
                position={[side * SHOULDER.x, SHOULDER.y, 0]}
                rotation={[0, 0, side * ARM_REST]}
              >
                <mesh position={[0, -0.33, 0]} material={mats.shell}>
                  <capsuleGeometry args={[0.16, 0.42, 8, 24]} />
                </mesh>
                <mesh position={[0, -0.62, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.trim}>
                  <torusGeometry args={[0.155, 0.045, 12, 32]} />
                </mesh>
                <mesh position={[0, -0.79, 0]} scale={[1, 0.9, 0.9]} material={mats.ring}>
                  <sphereGeometry args={[0.19, seg(32), seg(32)]} />
                </mesh>
              </group>
            ))}

            {/* legs: leg, saffron cuff, boot, hanging from a hip pivot */}
            {SIDES.map((side, i) => (
              <group
                key={side}
                ref={g => {
                  if (g) legs.current[i] = g;
                }}
                position={[side * HIP.x, HIP.y, 0]}
                rotation={[0, 0, side * 0.12]}
              >
                <mesh position={[0, -0.25, 0]} material={mats.shell}>
                  <capsuleGeometry args={[0.19, 0.3, 8, 24]} />
                </mesh>
                <mesh position={[0, -0.42, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.trim}>
                  <torusGeometry args={[0.19, 0.045, 12, 32]} />
                </mesh>
                <RoundedBox args={[0.36, 0.24, 0.44]} radius={0.09} position={[0, -0.6, 0.05]} material={mats.ring} />
              </group>
            ))}
          </group>

          <group ref={head}>
            {/* helmet shell, visor gasket, face */}
            <mesh scale={[1, 0.95, 0.97]} material={mats.shell}>
              <sphereGeometry args={[1, seg(96), seg(96)]} />
            </mesh>
            <mesh position={[0, FC.y, FC.z - 0.03]} scale={[FR.x + 0.035, FR.y + 0.035, FR.z]} material={mats.ring}>
              <sphereGeometry args={[1, seg(64), seg(64)]} />
            </mesh>
            <mesh position={[0, FC.y, FC.z]} scale={[FR.x, FR.y, FR.z]} material={mats.face}>
              <sphereGeometry args={[1, seg(64), seg(64)]} />
            </mesh>

            {/* ear caps and antenna */}
            {SIDES.map(side => (
              <mesh key={side} position={[side * 0.97, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.trim}>
                <cylinderGeometry args={[0.2, 0.2, 0.16, seg(48)]} />
              </mesh>
            ))}
            <group ref={antenna} position={[1.02, 0.12, 0]} rotation={[0, 0, -0.35]}>
              <mesh position={[0, 0.21, 0]} material={mats.ring}>
                <cylinderGeometry args={[0.018, 0.018, 0.42, 12]} />
              </mesh>
              <mesh position={[0, 0.45, 0]} material={mats.trim}>
                <sphereGeometry args={[0.065, seg(32), seg(32)]} />
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
                    <sphereGeometry args={[0.155, seg(48), seg(48)]} />
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
            {SIDES.map(side => (
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
      </group>

      {/* exhaust puffs, in world space */}
      <group>
        {Array.from({ length: PUFFS }, (_, i) => (
          <mesh
            key={i}
            ref={m => {
              if (m) puffMeshes.current[i] = m;
            }}
            geometry={puffGeometry}
            material={mats.puff}
            visible={false}
          />
        ))}
      </group>

      <QuadraticBezierLine
        ref={tether}
        start={ORIGIN}
        end={ORIGIN}
        color={TETHER}
        lineWidth={2}
        frustumCulled={false}
      />
    </>
  );
}
