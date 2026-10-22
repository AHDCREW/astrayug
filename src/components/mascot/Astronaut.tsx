import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { lookTarget, type Brain } from './useMascotBrain';

const SHELL = '#F6F4EE';
const SAFFRON = '#FF5B1F';
const RING = '#E3DFD5';
const METAL = '#3B3B42';
const INTERIOR = '#2A2740';
const LAMP = '#FFD36B';
const GOLD = '#E8A93A';
const GOLD_LIGHT = '#FFD37A';
const GOLD_DEEP = '#B8741A';

// The helmet is a shell with a round opening at the front, framed by a bezel. VISOR
// is the opening's half-angle.
const HELMET: [number, number, number] = [1, 0.95, 0.97];
const VISOR = 0.83;
const RIM = { r: Math.sin(VISOR), z: Math.cos(VISOR) };

// The gold sun visor, down over the opening: a cap of a shell just outside the helmet.
// It's a little wider than the opening, so it covers it whichever way the head turns,
// and stops short of the head lamps. It hangs on an arm to a pivot on each side, on
// the same axis as the side caps.
const SUN = { r: 1.1, cap: 0.86 };
// The pull tab hangs just below the visor's lower edge.
const SUN_TAB = SUN.cap + 0.03;

// Highlight streaks just proud of the sun visor: a long one with a thin one inside it
// at the top left, and a short one at the bottom right. Angles run anticlockwise from
// the viewer's right.
const GLINTS = [
  { r: 0.6, from: 1.95, arc: 0.75, tube: 0.02 },
  { r: 0.51, from: 2.1, arc: 0.4, tube: 0.011 },
  { r: 0.62, from: -0.95, arc: 0.32, tube: 0.014 },
];

// Bolts round the bezel, set on the side of the ring that faces out and forward.
const STUDS = Array.from({ length: 8 }, (_, k) => {
  const a = ((k + 0.5) / 8) * Math.PI * 2;
  const rim = new THREE.Vector3(RIM.r * Math.cos(a), RIM.r * Math.sin(a), RIM.z);
  const out = new THREE.Vector3(rim.x, rim.y, rim.z + 1).normalize();
  return rim.addScaledVector(out, 0.062);
});

// The model is built around the helmet's centre, which sits low enough that only the
// tops of the shoulders show above the bottom of the canvas. It stays there; only a
// boop lifts it, for a moment.
const REST_Y = -0.35;

const SIDES = [-1, 1] as const;

// Head lamps on the helmet's upper sides, each facing out along the surface.
const LAMPS = SIDES.map(side => {
  const dir = new THREE.Vector3(side * 0.68, 0.55, 0.48).normalize();
  return {
    side,
    position: dir.clone().multiplyScalar(0.99),
    quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir),
  };
});

// What the visor reflects, painted as a panorama: deep space with stars and the sun,
// a station window up high, and Earth's limb curving below the horizon. Across is all
// the way round; down runs from straight up to straight down. The window and the top
// of the limb repeat half a turn apart, so the reflection reads the same either way
// the panorama is mapped.
function visorReflection() {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // Canvas row for an elevation in degrees, 90 being straight up.
  const row = (deg: number) => h * (0.5 - deg / 180);

  const sky = ctx.createLinearGradient(0, 0, 0, row(-30));
  sky.addColorStop(0, '#04050c');
  sky.addColorStop(0.7, '#141b45');
  sky.addColorStop(1, '#2a3a7a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.25 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * row(-15), 0.8 + Math.random() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const sunX = w * 0.62;
  const sunY = row(28);
  const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 64);
  sun.addColorStop(0, '#ffffff');
  sun.addColorStop(0.15, '#fff6dc');
  sun.addColorStop(0.4, 'rgba(255,214,150,0.35)');
  sun.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(sunX - 64, sunY - 64, 128, 128);

  // A window with a cross frame, high enough that it lands on the upper half of the visor.
  for (const u of [0.25, 0.75]) {
    const left = u * w - 64;
    const top = row(68);
    const bottom = row(35);
    ctx.fillStyle = '#e8f0ff';
    ctx.shadowColor = '#9fb8ff';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.roundRect(left, top, 128, bottom - top, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a0d1f';
    ctx.fillRect(u * w - 4, top, 8, bottom - top);
    ctx.fillRect(left, (top + bottom) / 2 - 4, 128, 8);
  }

  // Earth, low enough that it reflects off the visor's lower edge.
  // Its blues are deep, since the gold turns bright blue a sickly green.
  const limb = (x: number) => row(-36 - (10 * (1 - Math.cos(4 * Math.PI * (x / w - 0.25)))) / 2);
  const earth = new Path2D();
  earth.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) earth.lineTo(x, limb(x));
  earth.lineTo(w, h);
  earth.closePath();
  const sea = ctx.createLinearGradient(0, row(-36), 0, h);
  sea.addColorStop(0, '#2a6cc0');
  sea.addColorStop(0.25, '#123a80');
  sea.addColorStop(1, '#040c22');
  ctx.fillStyle = sea;
  ctx.fill(earth);
  ctx.save();
  ctx.clip(earth);
  const blobs = (count: number, color: string, rx: number, ry: number) => {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = limb(x) + 6 + Math.random() * (h - limb(x)) * 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, rx * (0.4 + Math.random()), ry * (0.4 + Math.random()), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  blobs(14, 'rgba(150,130,80,0.5)', 40, 12);
  blobs(40, 'rgba(255,255,255,0.55)', 36, 6);
  ctx.restore();

  // The thin bright band of atmosphere along the limb.
  ctx.beginPath();
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, limb(x));
  ctx.strokeStyle = '#bfeaff';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#6cc6ff';
  ctx.shadowBlur = 18;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
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
  const antenna = useRef<THREE.Group>(null!);
  const cur = useRef({ x: 0, y: 0 });
  const anchor = useMemo(() => new THREE.Vector3(), []);

  const mats = useMemo(() => {
    // Clearcoat gives the glossy toy-plastic look, but it's the most expensive part of
    // the shading. The lite path uses plain standard materials.
    const gloss = (color: string, roughness: number, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
      lite
        ? new THREE.MeshStandardMaterial({
            color,
            roughness,
            metalness: extra.metalness ?? 0,
          })
        : new THREE.MeshPhysicalMaterial({ color, roughness, ...extra });
    return {
      shell: gloss(SHELL, 0.4, { clearcoat: 1, clearcoatRoughness: 0.25 }),
      trim: gloss(SAFFRON, 0.38, { clearcoat: 0.6, clearcoatRoughness: 0.3 }),
      ring: gloss(RING, 0.5, { clearcoat: 0.5 }),
      metal: gloss(METAL, 0.35, { metalness: 0.6, clearcoat: 0.3 }),
      glint: new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.8,
      }),
      // The padded inside of the helmet, in case it shows past the visor's edge.
      lining: new THREE.MeshStandardMaterial({
        color: INTERIOR,
        roughness: 0.9,
        side: THREE.BackSide,
      }),
      // The gold sun visor is solid, so nothing shows through it. It's two layers. First
      // the gold itself: lighter where it faces up and deeper where it turns edge-on.
      gold: new THREE.ShaderMaterial({
        uniforms: {
          light: { value: new THREE.Color(GOLD_LIGHT) },
          deep: { value: new THREE.Color(GOLD_DEEP) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalMatrix * normal;
            vView = -mv.xyz;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 light;
          uniform vec3 deep;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec3 n = normalize(vNormal);
            float edge = 1.0 - abs(dot(n, normalize(vView)));
            vec3 color = mix(deep, light, smoothstep(-0.6, 0.8, n.y));
            gl_FragColor = vec4(mix(color, deep, edge * 0.5), 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
      // Then its mirror reflections, added on top, tinted gold and turning white toward
      // the rim. They reflect a painted view of space, not the studio light the suit
      // sees, so the lite path, which has no studio light, gets them too.
      goldShine: new (lite ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial)({
        color: GOLD,
        metalness: 1,
        roughness: 0.08,
        envMap: visorReflection(),
        envMapIntensity: 1,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      lamp: new THREE.MeshBasicMaterial({ color: LAMP }),
    };
  }, [lite]);

  useEffect(
    () => () => {
      mats.goldShine.envMap?.dispose();
      Object.values(mats).forEach(m => m.dispose());
    },
    [mats],
  );

  useFrame(({ camera, size, clock }, dt) => {
    const b = brain.current;
    const now = performance.now();
    const c = cur.current;

    // Project the head centre to screen space so tracking is relative to where it really is.
    // `size` is the canvas's on-screen box, which R3F re-measures on resize and scroll,
    // so there's no layout read here every frame.
    head.current.getWorldPosition(anchor).project(camera);
    const screen = {
      x: size.left + ((anchor.x + 1) / 2) * size.width,
      y: size.top + ((1 - anchor.y) / 2) * size.height,
    };

    const look = lookTarget(b, screen, now);
    const lambda = b.reduced ? 1000 : 6;
    c.x = THREE.MathUtils.damp(c.x, look.x, lambda, dt);
    c.y = THREE.MathUtils.damp(c.y, look.y, lambda, dt);

    head.current.rotation.set(c.y * 0.3, c.x * 0.5, -c.x * 0.06);
    body.current.rotation.y = c.x * 0.15;

    // Boop: a quick hop with squash and stretch, settling in under a second.
    const t = (now - b.boopAt) / 1000;
    let hop = 0;
    let squash = 0;
    if (t >= 0 && t < 0.9 && !b.reduced) {
      hop = t < 0.45 ? Math.sin((t / 0.45) * Math.PI) * 0.28 : 0;
      squash = Math.exp(-t * 7) * Math.sin(t * 22) * 0.1;
    }
    rig.current.position.y = REST_Y + hop;
    rig.current.scale.set(1 - squash * 0.6, 1 + squash, 1 - squash * 0.6);

    antenna.current.rotation.z = -0.35 + (b.reduced ? 0 : Math.sin(clock.elapsedTime * 2.2) * 0.07);
  });

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
      {/* the tops of the shoulders, cut off by the bottom of the canvas: torso, and the
          neck ring with its latches */}
      <group ref={body}>
        <mesh position={[0, -1.55, 0]} scale={[1.35, 1, 0.9]} material={mats.shell}>
          <capsuleGeometry args={[0.62, 0.5, 12, seg(48)]} />
        </mesh>
        <mesh position={[0, -0.93, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.ring}>
          <torusGeometry args={[0.5, 0.09, 24, seg(64)]} />
        </mesh>
        {SIDES.map(side => (
          <RoundedBox
            key={side}
            args={[0.11, 0.08, 0.08]}
            radius={0.02}
            position={[side * 0.25, -0.93, 0.52]}
            rotation={[0, side * 0.46, 0]}
            material={mats.trim}
          />
        ))}
      </group>

      <group ref={head}>
        {/* helmet: shell open at the front, padded lining, bezel round the opening */}
        <group scale={HELMET}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.shell}>
            <sphereGeometry args={[1, seg(96), seg(72), 0, Math.PI * 2, VISOR, Math.PI - VISOR]} />
          </mesh>
          <mesh material={mats.lining}>
            <sphereGeometry args={[0.965, seg(48), seg(48)]} />
          </mesh>
          <mesh position={[0, 0, RIM.z]} material={mats.ring}>
            <torusGeometry args={[RIM.r, 0.065, 20, seg(72)]} />
          </mesh>
          {STUDS.map((position, k) => (
            <mesh key={k} position={position} material={mats.metal}>
              <sphereGeometry args={[0.022, 12, 10]} />
            </mesh>
          ))}
        </group>

        {/* visor hinge caps with a metal hub, head lamps, antenna */}
        {SIDES.map(side => (
          <group key={side} position={[side * 0.97, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh material={mats.trim}>
              <cylinderGeometry args={[0.2, 0.2, 0.16, seg(48)]} />
            </mesh>
            <mesh material={mats.metal}>
              <cylinderGeometry args={[0.09, 0.09, 0.2, 24]} />
            </mesh>
          </group>
        ))}
        {LAMPS.map(({ side, position, quaternion }) => (
          <group key={side} position={position} quaternion={quaternion}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.ring}>
              <cylinderGeometry args={[0.085, 0.1, 0.1, 24]} />
            </mesh>
            <mesh position={[0, 0, 0.051]} material={mats.lamp}>
              <circleGeometry args={[0.062, 24]} />
            </mesh>
          </group>
        ))}
        <group ref={antenna} position={[1.02, 0.12, 0]} rotation={[0, 0, -0.35]}>
          <mesh position={[0, 0.21, 0]} material={mats.ring}>
            <cylinderGeometry args={[0.018, 0.018, 0.42, 12]} />
          </mesh>
          <mesh position={[0, 0.45, 0]} material={mats.trim}>
            <sphereGeometry args={[0.065, seg(32), seg(32)]} />
          </mesh>
        </group>

        {/* the solid gold sun visor with its reflections over it, then the highlight
            streaks. The render order keeps the layers in that order. */}
        <group scale={HELMET}>
          {[mats.gold, mats.goldShine].map((m, i) => (
            <mesh key={i} rotation={[Math.PI / 2, 0, 0]} material={m} renderOrder={i}>
              <sphereGeometry args={[SUN.r, seg(64), seg(32), 0, Math.PI * 2, 0, SUN.cap]} />
            </mesh>
          ))}
          {GLINTS.map(({ r, from, arc, tube }) => (
            <mesh
              key={from}
              position={[0, 0, Math.sqrt(SUN.r ** 2 - r ** 2) + 0.012]}
              rotation={[0, 0, from]}
              material={mats.glint}
              renderOrder={2}
            >
              <torusGeometry args={[r, tube, 8, 48, arc]} />
            </mesh>
          ))}

          {/* the sun visor's rim, a pull tab, and an arm back to a pivot on each side.
              The arms are strips of the shell that narrow to the pivot. */}
          <mesh position={[0, 0, SUN.r * Math.cos(SUN.cap)]} material={mats.ring}>
            <torusGeometry args={[SUN.r * Math.sin(SUN.cap), 0.02, 12, seg(72)]} />
          </mesh>
          <RoundedBox
            args={[0.16, 0.06, 0.03]}
            radius={0.012}
            position={[0, -Math.sin(SUN_TAB) * (SUN.r + 0.008), Math.cos(SUN_TAB) * (SUN.r + 0.008)]}
            rotation={[SUN_TAB, 0, 0]}
            material={mats.trim}
          />
          {SIDES.map(side => (
            <group key={side} scale={[side, 1, 1]}>
              <mesh rotation={[0, 0, -Math.PI / 2]} material={mats.ring}>
                <sphereGeometry args={[SUN.r - 0.004, 6, 12, Math.PI / 2 - 0.07, 0.14, 0.08, Math.PI / 2 - SUN.cap - 0.03]} />
              </mesh>
              <mesh position={[SUN.r, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.trim}>
                <cylinderGeometry args={[0.11, 0.11, 0.05, 24]} />
              </mesh>
              <mesh position={[SUN.r + 0.01, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.metal}>
                <cylinderGeometry args={[0.045, 0.045, 0.06, 16]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
