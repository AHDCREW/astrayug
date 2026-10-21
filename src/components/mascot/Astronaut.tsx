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
const INTERIOR = '#2A2740';
const LAMP = '#FFD36B';
const READOUT = '#FFA27A';
const TINT = '#141A3C';
const GOLD = '#E8A93A';
const GOLD_LIGHT = '#FFD37A';
const GOLD_DEEP = '#B8741A';

// The helmet is a shell with a round opening at the front, framed by a bezel and
// closed by a glass dome that bulges a little past it. VISOR is the opening's
// half-angle. The dome is the sphere through the bezel whose front sits BULGE out.
const HELMET: [number, number, number] = [1, 0.95, 0.97];
const VISOR = 0.83;
const BULGE = 0.07;
const RIM = { r: Math.sin(VISOR), z: Math.cos(VISOR) };
const DOME_D = 1 + BULGE - RIM.z;
const DOME_R = (RIM.r ** 2 + DOME_D ** 2) / (2 * DOME_D);
const DOME_Z = 1 + BULGE - DOME_R;
const DOME_ARC = Math.asin(RIM.r / DOME_R);

// The gold sun visor, down over the face: a cap of a shell just outside the helmet.
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

// Face ellipsoid inside the helmet: centre and radii. Features sit on its surface.
const FC = { y: -0.06, z: 0.5 };
const FR = { x: 0.68, y: 0.56, z: 0.44 };
const faceZ = (x: number, y: number) => FC.z + FR.z * Math.sqrt(Math.max(0, 1 - (x / FR.x) ** 2 - ((y - FC.y) / FR.y) ** 2));

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

// Visible height at the camera's distance for fov 24 at z = 7.
const WORLD_H = 2 * 7 * Math.tan((12 * Math.PI) / 180);

const SPIN_S = 1.1;
const PUFFS = 14;
const SIDES = [-1, 1] as const;

// Front face of the chest control unit.
const CHEST = { y: -1.4, z: 0.52 };

// Head lamps on the helmet's upper sides, each facing out along the surface.
const LAMPS = SIDES.map(side => {
  const dir = new THREE.Vector3(side * 0.68, 0.55, 0.48).normalize();
  return {
    side,
    position: dir.clone().multiplyScalar(0.99),
    quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir),
  };
});

// Hoses run from the chest unit round the waist into the side of the pack. This is
// the viewer's right one; the left is the same geometry mirrored.
const HOSE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.3, -1.46, 0.46),
  new THREE.Vector3(0.5, -1.68, 0.38),
  new THREE.Vector3(0.67, -1.74, 0.03),
  new THREE.Vector3(0.62, -1.56, -0.34),
]);
const HOSE_RIBS = 26;

function hoseGeometry(tubular: number, radial: number) {
  const geometry = new THREE.TubeGeometry(HOSE, tubular, 0.036, radial);
  const pos = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  // Push each ring of vertices in and out along its normal, which corrugates the tube.
  for (let k = 0; k < pos.count; k++) {
    const u = Math.floor(k / (radial + 1)) / tubular;
    const out = 0.004 * Math.cos(u * HOSE_RIBS * Math.PI * 2);
    pos.setXYZ(k, pos.getX(k) + normal.getX(k) * out, pos.getY(k) + normal.getY(k) * out, pos.getZ(k) + normal.getZ(k) * out);
  }
  geometry.computeVertexNormals();
  return geometry;
}

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

  // A window with a cross frame, high enough that it lands on the visor above the eyes.
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

  // Earth, low enough that it reflects off the visor's lower edge, under the mouth.
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
  onDragStart: (x: number, y: number) => void;
  // Cheaper materials and rounder-by-fewer-polygons spheres, for slower devices.
  lite: boolean;
}

export default function Astronaut({ brain, onBoop, onHover, onDragStart, lite }: AstronautProps) {
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
  const gasp = useRef<THREE.Mesh>(null!);
  const antenna = useRef<THREE.Group>(null!);
  const arms = useRef<THREE.Group[]>([]);
  const legs = useRef<THREE.Group[]>([]);
  const nozzles = useRef<THREE.Group[]>([]);
  const puffMeshes = useRef<THREE.Mesh[]>([]);
  const clip = useRef<THREE.Group>(null!);
  const tether = useRef<QuadraticBezierLineRef>(null!);
  const cur = useRef({
    x: 0,
    y: 0,
    lean: 0,
    shock: 0,
    dragX: 0,
    dragY: 0,
    goalX: 0,
    goalY: 0,
    restX: 0,
    restY: 0,
    grin: 0,
    wave: [0, 0],
    seenBoop: -Infinity,
    spinAt: -Infinity,
    nextPuff: 0,
    nextSlot: 0,
  });
  const tmp = useMemo(
    () => ({
      anchor: new THREE.Vector3(),
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      q: new THREE.Quaternion(),
    }),
    [],
  );
  const puffs = useRef<Puff[]>(
    Array.from({ length: PUFFS }, () => ({
      age: 1,
      life: 1,
      size: 0,
      vel: new THREE.Vector3(),
    })),
  );
  const puffGeometry = useMemo(() => new THREE.SphereGeometry(1, 16, 12), []);
  const hose = useMemo(() => hoseGeometry(lite ? 104 : 208, lite ? 8 : 12), [lite]);

  const mats = useMemo(() => {
    // Clearcoat and sheen give the glossy toy-plastic look, but they're the most
    // expensive part of the shading. The lite path uses plain standard materials.
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
      face: gloss(FACE, 0.5, {
        clearcoat: 1,
        clearcoatRoughness: 0.2,
        sheen: 0.5,
        sheenColor: new THREE.Color('#ffd9df'),
      }),
      eye: gloss(EYE, 0.12, { clearcoat: 1, clearcoatRoughness: 0.04 }),
      shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      mouth: new THREE.MeshStandardMaterial({
        color: MOUTH,
        roughness: 0.6,
        side: THREE.DoubleSide,
      }),
      ring: gloss(RING, 0.5, { clearcoat: 0.5 }),
      metal: gloss(METAL, 0.35, { metalness: 0.6, clearcoat: 0.3 }),
      blush: new THREE.MeshBasicMaterial({
        map: blushTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.6,
      }),
      glint: new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.8,
      }),
      puff: new THREE.MeshStandardMaterial({
        color: PUFF,
        roughness: 1,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
      // The padded inside of the helmet, seen around the face.
      lining: new THREE.MeshStandardMaterial({
        color: INTERIOR,
        roughness: 0.9,
        side: THREE.BackSide,
      }),
      // A faint smoky tint on the glass visor, deepening where it's seen edge-on.
      tint: new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(TINT) } },
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
          uniform vec3 color;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float edge = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
            gl_FragColor = vec4(color, mix(0.05, 0.6, pow(edge, 1.5)));
            #include <colorspace_fragment>
          }
        `,
        transparent: true,
        depthWrite: false,
      }),
      // The gold sun visor is two layers over the glass, and the face still shows
      // through both, so its expressions read through the visor. First a gold film:
      // thin in the middle, close to solid where the visor turns edge-on, and lighter
      // where it faces up.
      goldFilm: new THREE.ShaderMaterial({
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
            gl_FragColor = vec4(mix(color, deep, edge * 0.5), mix(0.35, 0.9, pow(edge, 1.3)));
            #include <colorspace_fragment>
          }
        `,
        transparent: true,
        depthWrite: false,
      }),
      // Then the gold's mirror reflections, added on top, tinted gold and turning white
      // toward the rim. Real transmission would drop the blush, since its pass only sees
      // opaque objects. They reflect a painted view of space, not the studio light the
      // suit sees, so the lite path, which has no studio light, gets them too.
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
      readout: new THREE.MeshBasicMaterial({ color: READOUT }),
    };
  }, [lite]);

  useEffect(
    () => () => {
      mats.blush.map?.dispose();
      mats.goldShine.envMap?.dispose();
      Object.values(mats).forEach(m => m.dispose());
      puffGeometry.dispose();
      hose.dispose();
    },
    [mats, puffGeometry, hose],
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

  useFrame(({ camera, size, clock }, dt) => {
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
    // Dragging pulls it away from its spot, and it stays where it's let go. Where it was
    // left is kept as an offset from home, so it still scrolls with the page.
    // The canvas covers the whole screen. Zooming the camera keeps the astronaut the size
    // it was on its stage, and the stage's screen position becomes its home in world space.
    const cam = camera as THREE.PerspectiveCamera;
    const zoom = b.stage.h > 0 ? b.stage.h / size.height : 1;
    if (Math.abs(cam.zoom - zoom) > 1e-4) {
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
    }
    const worldH = WORLD_H / zoom;
    const worldW = worldH * (size.width / size.height);
    const toWorld = worldH / size.height;
    const homeX = (b.stage.cx - size.width / 2) * toWorld;
    const homeY = -(b.stage.cy - size.height / 2) * toWorld;
    const held = b.dragging && b.dragMoved;
    // Kept on screen while dragged, so it can go anywhere on the page but not off it.
    const limX = Math.max(0, worldW / 2 - 0.9);
    const limY = Math.max(0, worldH / 2 - 1);
    if (held) {
      c.goalX = THREE.MathUtils.clamp(homeX + c.restX + b.drag.x * toWorld, -limX, limX) - homeX;
      c.goalY = THREE.MathUtils.clamp(homeY + c.restY - b.drag.y * toWorld, -limY, limY) - homeY;
    } else {
      c.restX = c.goalX;
      c.restY = c.goalY;
    }
    c.dragX = THREE.MathUtils.damp(c.dragX, c.goalX, held ? 18 : 3, dt);
    c.dragY = THREE.MathUtils.damp(c.dragY, c.goalY, held ? 18 : 3, dt);
    c.shock = THREE.MathUtils.damp(c.shock, held ? 1 : 0, 14, dt);
    rig.current.position.set(
      float * (Math.sin(t * 0.21) * 0.5 + Math.sin(t * 0.53 + 1) * 0.12) + c.x * c.lean * 0.2 + homeX + c.dragX,
      BASE_Y + homeY + float * (Math.sin(t * 0.29) * 0.12 + Math.sin(t * 0.71 + 2) * 0.04) - c.y * c.lean * 0.12 + fling * 0.25 + c.dragY,
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
      const sway = float * Math.sin(t * 1.3 + i * 1.7) * 0.18 + fling * 0.9 + c.shock * (0.9 + float * Math.sin(t * 14 + i * 2.4) * 0.3);
      const flap = float * Math.sin(t * 9) * 0.35;
      arm.rotation.z = side * (ARM_REST + sway + wave * (ARM_WAVE - ARM_REST + flap));
      arm.rotation.x = float * Math.sin(t * 0.9 + i) * 0.15;
    });
    // Legs kick slowly out of step.
    legs.current.forEach((leg, i) => {
      leg.rotation.x = float * Math.sin(t * 1.1 + i * Math.PI) * 0.28 + c.shock * float * Math.sin(t * 16 + i * Math.PI) * 0.35;
      leg.rotation.z = SIDES[i] * (0.12 + float * Math.sin(t * 0.8 + i) * 0.05 + fling * 0.3);
    });

    // Blink, and squint a little while grinning.
    const open = isBlinking(b, now) && c.shock < 0.5 ? 0.08 : 1 - c.grin * 0.25 + c.shock * 0.3;
    eyeL.current.scale.y = eyeR.current.scale.y = THREE.MathUtils.damp(eyeL.current.scale.y, open, 40, dt);
    eyeL.current.scale.x = eyeR.current.scale.x = 1 + c.shock * 0.25;

    const startled = c.shock > 0.5;
    gasp.current.visible = startled;
    gasp.current.scale.setScalar(0.6 + c.shock * 0.4 + float * Math.sin(t * 18) * 0.05 * c.shock);
    smile.current.visible = !startled && c.grin < 0.5;
    grin.current.visible = !startled && c.grin >= 0.5;
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
    tmp.start.set(-worldW / 2 - 0.4, -worldH / 2 - 0.4, -0.6);
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
        onPointerDown={e => {
          e.stopPropagation();
          onDragStart(e.clientX, e.clientY);
        }}
        onClick={e => {
          e.stopPropagation();
          if (!brain.current.dragMoved) onBoop();
        }}
        onPointerOver={e => {
          e.stopPropagation();
          onHover(true);
        }}
        onPointerOut={() => onHover(false)}
      >
        <group scale={SCALE} position={[0, CENTER_Y * SCALE, 0]}>
          <group ref={body}>
            {/* torso, neck ring with its latches, waist belt and buckle */}
            <mesh position={[0, -1.42, 0]} scale={[1.25, 1, 0.95]} material={mats.shell}>
              <capsuleGeometry args={[0.5, 0.35, 12, seg(40)]} />
            </mesh>
            <mesh position={[0, -0.9, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.ring}>
              <torusGeometry args={[0.46, 0.085, 20, seg(56)]} />
            </mesh>
            {SIDES.map(side => (
              <RoundedBox
                key={side}
                args={[0.1, 0.07, 0.07]}
                radius={0.02}
                position={[side * 0.2, -0.9, 0.49]}
                rotation={[0, side * 0.42, 0]}
                material={mats.trim}
              />
            ))}
            <mesh position={[0, -1.8, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.25, 0.95, 1]} material={mats.ring}>
              <torusGeometry args={[0.456, 0.045, 12, seg(56)]} />
            </mesh>
            <RoundedBox args={[0.17, 0.11, 0.05]} radius={0.02} position={[0, -1.8, 0.47]} material={mats.trim} />

            {/* chest control unit: a screen with readouts, a dial and three buttons */}
            <group position={[0, CHEST.y, CHEST.z]}>
              <RoundedBox args={[0.58, 0.36, 0.12]} radius={0.045} position={[0, 0, -0.06]} material={mats.trim} />
              <RoundedBox args={[0.3, 0.15, 0.03]} radius={0.012} position={[-0.08, 0.05, 0]} material={mats.eye} />
              <mesh position={[-0.11, 0.08, 0.017]} material={mats.shine}>
                <planeGeometry args={[0.18, 0.022]} />
              </mesh>
              <mesh position={[-0.145, 0.03, 0.017]} material={mats.readout}>
                <planeGeometry args={[0.11, 0.022]} />
              </mesh>
              <mesh position={[0.17, 0.05, 0.01]} rotation={[Math.PI / 2, 0, 0]} material={mats.metal}>
                <cylinderGeometry args={[0.05, 0.055, 0.05, 24]} />
              </mesh>
              {[mats.shine, mats.eye, mats.shine].map((m, i) => (
                <mesh key={i} position={[-0.18 + i * 0.1, -0.09, 0]} material={m}>
                  <sphereGeometry args={[0.03, 16, 16]} />
                </mesh>
              ))}
            </group>

            {/* ribbed hoses from the chest unit round to the pack, with a connector at each end */}
            {SIDES.map(side => (
              <group key={side} scale={[side, 1, 1]}>
                <mesh geometry={hose} material={mats.ring} />
                <mesh position={[0.3, -1.46, 0.46]} rotation={[0, 0, Math.PI / 2]} material={mats.metal}>
                  <cylinderGeometry args={[0.055, 0.055, 0.06, 20]} />
                </mesh>
                <mesh position={[0.62, -1.56, -0.33]} rotation={[Math.PI / 2, 0, 0]} material={mats.metal}>
                  <cylinderGeometry args={[0.055, 0.055, 0.06, 20]} />
                </mesh>
              </group>
            ))}

            {/* jetpack with a saffron band, side vents, two nozzles and a D-ring for the tether */}
            <RoundedBox args={[1.4, 1.05, 0.45]} radius={0.14} position={[0, -1.35, -0.55]} material={mats.shell} />
            <RoundedBox args={[1.42, 0.12, 0.47]} radius={0.05} position={[0, -1.1, -0.55]} material={mats.trim} />
            {SIDES.map(side => (
              <group key={side} position={[side * 0.705, -1.48, -0.55]}>
                <RoundedBox args={[0.04, 0.4, 0.26]} radius={0.015} material={mats.metal} />
                {[-1, 0, 1].map(k => (
                  <mesh key={k} position={[side * 0.022, k * 0.11, 0]} material={mats.ring}>
                    <boxGeometry args={[0.02, 0.035, 0.22]} />
                  </mesh>
                ))}
              </group>
            ))}
            <mesh position={[-0.77, -1.52, -0.55]} material={mats.metal}>
              <torusGeometry args={[0.07, 0.02, 10, 24]} />
            </mesh>
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
            <group ref={clip} position={[-0.84, -1.52, -0.55]} />

            {/* arms, hanging from a shoulder pivot: shoulder bearing, sleeve with an
                accordion elbow, saffron cuff, wrist bearing, and a mitten glove with a thumb.
                The mission patch goes on the astronaut's own left arm. */}
            {SIDES.map((side, i) => (
              <group
                key={side}
                ref={g => {
                  if (g) arms.current[i] = g;
                }}
                position={[side * SHOULDER.x, SHOULDER.y, 0]}
                rotation={[0, 0, side * ARM_REST]}
              >
                <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.ring}>
                  <torusGeometry args={[0.17, 0.035, 12, 32]} />
                </mesh>
                <mesh position={[0, -0.33, 0]} material={mats.shell}>
                  <capsuleGeometry args={[0.16, 0.42, 8, 24]} />
                </mesh>
                {[-0.32, -0.39].map(y => (
                  <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.ring}>
                    <torusGeometry args={[0.162, 0.02, 8, 32]} />
                  </mesh>
                ))}
                {side === 1 && (
                  <group position={[0, -0.2, 0.15]}>
                    <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.eye}>
                      <cylinderGeometry args={[0.07, 0.07, 0.03, 32]} />
                    </mesh>
                    <mesh position={[0, 0, 0.02]} material={mats.trim}>
                      <sphereGeometry args={[0.028, 16, 16]} />
                    </mesh>
                    <group position={[0, 0, 0.02]} rotation={[0, 0, -0.35]}>
                      <mesh rotation={[1.2, 0, 0]} material={mats.shine}>
                        <torusGeometry args={[0.05, 0.006, 6, 32]} />
                      </mesh>
                    </group>
                  </group>
                )}
                <mesh position={[0, -0.62, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.trim}>
                  <torusGeometry args={[0.155, 0.045, 12, 32]} />
                </mesh>
                <mesh position={[0, -0.68, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.metal}>
                  <torusGeometry args={[0.135, 0.028, 10, 32]} />
                </mesh>
                <mesh position={[0, -0.82, 0]} scale={[1, 1.05, 0.85]} material={mats.ring}>
                  <sphereGeometry args={[0.17, seg(32), seg(32)]} />
                </mesh>
                <mesh position={[0, -0.77, 0.12]} rotation={[1.2, 0, 0]} material={mats.ring}>
                  <capsuleGeometry args={[0.055, 0.06, 6, 16]} />
                </mesh>
              </group>
            ))}

            {/* legs, hanging from a hip pivot: leg with a thigh pocket, saffron cuff, boot with a sole */}
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
                <group position={[side * 0.1, -0.24, 0.15]} rotation={[0, side * 0.55, 0]}>
                  <RoundedBox args={[0.13, 0.13, 0.05]} radius={0.02} material={mats.ring} />
                  <RoundedBox args={[0.14, 0.045, 0.06]} radius={0.015} position={[0, 0.05, 0.005]} material={mats.trim} />
                </group>
                <mesh position={[0, -0.42, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.trim}>
                  <torusGeometry args={[0.19, 0.045, 12, 32]} />
                </mesh>
                <RoundedBox args={[0.36, 0.24, 0.44]} radius={0.09} position={[0, -0.6, 0.05]} material={mats.ring} />
                <RoundedBox args={[0.39, 0.08, 0.47]} radius={0.035} position={[0, -0.71, 0.05]} material={mats.metal} />
              </group>
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
            <mesh position={[0, FC.y, FC.z]} scale={[FR.x, FR.y, FR.z]} material={mats.face}>
              <sphereGeometry args={[1, seg(64), seg(64)]} />
            </mesh>

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

            {/* open "oh" mouth, shown while being dragged */}
            <mesh
              ref={gasp}
              position={[0, -0.2, mouthZ + 0.006]}
              rotation={[0.22, 0, 0]}
              scale={[0.6, 0.8, 1]}
              material={mats.mouth}
              visible={false}
            >
              <circleGeometry args={[0.085, 32]} />
            </mesh>

            {/* tinted glass visor, then the gold sun visor's film and reflections over it,
                then the highlight streaks. The render order keeps the layers in that
                order and after the blush. */}
            <group scale={HELMET}>
              <mesh position={[0, 0, DOME_Z]} rotation={[Math.PI / 2, 0, 0]} material={mats.tint} renderOrder={1}>
                <sphereGeometry args={[DOME_R, seg(64), seg(32), 0, Math.PI * 2, 0, DOME_ARC]} />
              </mesh>
              {[mats.goldFilm, mats.goldShine].map((m, i) => (
                <mesh key={i} rotation={[Math.PI / 2, 0, 0]} material={m} renderOrder={i + 2}>
                  <sphereGeometry args={[SUN.r, seg(64), seg(32), 0, Math.PI * 2, 0, SUN.cap]} />
                </mesh>
              ))}
              {GLINTS.map(({ r, from, arc, tube }) => (
                <mesh
                  key={from}
                  position={[0, 0, Math.sqrt(SUN.r ** 2 - r ** 2) + 0.012]}
                  rotation={[0, 0, from]}
                  material={mats.glint}
                  renderOrder={4}
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

      <QuadraticBezierLine ref={tether} start={ORIGIN} end={ORIGIN} color={TETHER} lineWidth={2} frustumCulled={false} />
    </>
  );
}
