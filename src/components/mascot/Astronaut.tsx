import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lookTarget, type Brain } from './useMascotBrain';

const SHELL = '#F6F4EE';
const SAFFRON = '#FF5B1F';
const RING = '#E3DFD5';
const METAL = '#3B3B42';
const NAVY = '#1D1B4F';
const INTERIOR = '#2A2740';
const LAMP = '#FFD36B';
const GOLD = '#F2BF55';

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
// Pull tabs hang just below the visor's lower edge: a big one in the middle and a small
// one either side, at these angles round from the bottom.
const SUN_TAB = SUN.cap + 0.03;
const TABS = [-0.75, 0, 0.75];

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

// Something sitting on the helmet's surface in direction `dir`, facing out along it.
const onShell = (dir: THREE.Vector3, lift = 0) => ({
  position: dir.clone().normalize().multiplyScalar(1 + lift),
  quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()),
});

// Head lamps on the helmet's upper sides.
const LAMPS = SIDES.map(side => ({ side, ...onShell(new THREE.Vector3(side * 0.68, 0.55, 0.48), -0.01) }));

// A mission patch on the side of the helmet, above the hinge cap and below the lamp.
const PATCH = onShell(new THREE.Vector3(-0.85, 0.42, 0.3), 0.004);

// The antenna's beacon flashes once per period.
const BEACON_S = 1.6;

// Grip ridges round the rim of a hinge cap, merged into one geometry. The cap's axis is
// its local y.
function gripGeometry() {
  const parts = Array.from({ length: 18 }, (_, k) => {
    const a = (k / 18) * Math.PI * 2;
    return new THREE.BoxGeometry(0.03, 0.12, 0.022).rotateY(-a).translate(0.2 * Math.cos(a), 0, 0.2 * Math.sin(a));
  });
  const merged = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  return merged;
}

// Smooth value noise, and the sum of several octaves of it, for land and cloud. Each
// octave adds detail at twice the frequency and half the strength. Results are 0..1.
function hash(x: number, y: number) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) {
  let sum = 0;
  let amp = 0.5;
  for (let f = 1; f <= 8; f *= 2, amp /= 2) sum += amp * noise(x * f, y * f);
  return sum / 0.9375;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// What the visor reflects: the view from orbit as a panorama. Deep space with the Milky
// Way and the sun, a station module and solar array off to one side, and Earth filling
// the lower half, with land, cloud and a glowing rim of atmosphere.
//
// It's high dynamic range. The sun, the sunlit clouds and the atmosphere are brighter
// than white, so they flare off the gold the way real highlights do instead of
// flattening to plain white.
//
// Across is all the way round, and the middle of the visor reflects what's three
// quarters of the way across. Down runs from straight up to straight down.
function visorEnvironment() {
  const w = 1024;
  const h = 512;
  const col = (u: number) => u * w;
  // Canvas row for an elevation in degrees, 90 being straight up.
  const row = (deg: number) => h * (0.5 - deg / 180);
  // Earth's limb, in degrees: highest straight ahead, dropping away round the sides.
  const limbDeg = (x: number) => -1 - 12 * (1 - Math.cos(2 * Math.PI * (x / w - 0.75)));
  const limb = (x: number) => row(limbDeg(x));
  // The sun sits where the scene's key light is, so its reflection and the light's own
  // highlight on the visor are one and the same.
  const sun = { x: col(0.665), y: row(35) };

  const paint = (draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    draw(ctx);
    return ctx.getImageData(0, 0, w, h).data;
  };
  const traceLimb = (ctx: CanvasRenderingContext2D, lift: number) => {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, limb(x) - lift);
  };

  // The sky in ordinary light, as sRGB colour. Earth is worked out per pixel below.
  const base = paint(ctx => {
    const sky = ctx.createLinearGradient(0, 0, 0, row(-10));
    sky.addColorStop(0, '#010207');
    sky.addColorStop(0.75, '#070b22');
    sky.addColorStop(1, '#14245a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // The Milky Way: a faint band of haze and close-packed stars, tilted across the sky.
    const band = (x: number) => row(40 + 20 * Math.sin((x / w) * Math.PI * 2 + 0.6));
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * w;
      const y = band(x) + (Math.random() - 0.5) * 40;
      const r = 20 + Math.random() * 40;
      const haze = ctx.createRadialGradient(x, y, 0, x, y, r);
      haze.addColorStop(0, 'rgba(160,150,220,0.07)');
      haze.addColorStop(1, 'rgba(160,150,220,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.fillStyle = '#ffffff';
    const star = (x: number, y: number, r: number) => {
      ctx.globalAlpha = 0.3 + Math.random() * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * w;
      star(x, band(x) + (Math.random() - 0.5) * 50, 0.4 + Math.random() * 0.6);
    }
    for (let i = 0; i < 260; i++) star(Math.random() * w, Math.random() * row(-5), 0.5 + Math.random() * 1.1);
    ctx.globalAlpha = 1;

    // The sun's glare, warm toward its edge.
    const glare = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 24);
    glare.addColorStop(0, '#ffffff');
    glare.addColorStop(0.25, '#fff4d6');
    glare.addColorStop(0.6, 'rgba(255,210,150,0.12)');
    glare.addColorStop(1, 'rgba(255,210,150,0)');
    ctx.fillStyle = glare;
    ctx.fillRect(sun.x - 24, sun.y - 24, 48, 48);

    const line = (x0: number, y0: number, x1: number, y1: number) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };

    // A station module across the upper left: a sunlit white cylinder, shaded round its
    // curve, with seams, a dark window and a docking ring at its end.
    const mod = { x0: col(0.8), x1: col(0.95), top: row(27), bottom: row(9) };
    const shade = ctx.createLinearGradient(0, mod.top, 0, mod.bottom);
    shade.addColorStop(0, '#f4f2ec');
    shade.addColorStop(0.45, '#d9d6cf');
    shade.addColorStop(1, '#6d6b70');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.roundRect(mod.x0, mod.top, mod.x1 - mod.x0, mod.bottom - mod.top, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,80,90,0.5)';
    ctx.lineWidth = 1.5;
    for (let k = 1; k < 5; k++) {
      const x = mod.x0 + ((mod.x1 - mod.x0) * k) / 5;
      line(x, mod.top + 2, x, mod.bottom - 2);
    }
    ctx.fillStyle = '#10142a';
    ctx.fillRect(mod.x0 + 40, mod.top + 10, 16, 10);
    ctx.fillStyle = '#a9a7a2';
    ctx.fillRect(mod.x1 - 2, mod.top + 6, 8, mod.bottom - mod.top - 12);

    // Above it, a solar array: a braced truss with panel wings above and below, each a
    // grid of cells in a gold frame.
    const truss = { x0: col(0.79), x1: col(0.97), y: row(40) };
    ctx.strokeStyle = '#9a9fac';
    ctx.lineWidth = 3;
    line(truss.x0, truss.y, truss.x1, truss.y);
    ctx.lineWidth = 1;
    for (let x = truss.x0; x < truss.x1; x += 8) line(x, truss.y - 3, x + 8, truss.y + 3);
    const span = (truss.x1 - truss.x0 - 16) / 4;
    const tall = 30;
    for (let k = 0; k < 4; k++) {
      const x = truss.x0 + 8 + k * span;
      const pw = span - 6;
      for (const top of [truss.y - 6 - tall, truss.y + 6]) {
        ctx.fillStyle = '#1b2a5a';
        ctx.fillRect(x, top, pw, tall);
        ctx.strokeStyle = 'rgba(120,140,200,0.35)';
        ctx.lineWidth = 1;
        for (let c = 1; c < 4; c++) line(x + (pw * c) / 4, top, x + (pw * c) / 4, top + tall);
        for (let c = 1; c < 3; c++) line(x, top + (tall * c) / 3, x + pw, top + (tall * c) / 3);
        ctx.strokeStyle = 'rgba(214,180,110,0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, top, pw, tall);
      }
    }

    // Haze rising off the limb.
    ctx.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      traceLimb(ctx, k * 2);
      ctx.strokeStyle = `rgba(140,205,255,${0.5 - k * 0.08})`;
      ctx.stroke();
    }
  });

  // The bright layer, as linear intensity on black: the sun's disc and glow, and the
  // line of atmosphere along the limb.
  const GAIN = 30;
  const light = paint(ctx => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const glow = (r: number, inner: string) => {
      const g = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, r);
      g.addColorStop(0, inner);
      g.addColorStop(1, 'rgba(255,230,190,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sun.x - r, sun.y - r, r * 2, r * 2);
    };
    glow(30, 'rgba(255,230,190,0.02)');
    glow(7, '#ffffff');
    traceLimb(ctx, 1);
    ctx.strokeStyle = 'rgba(120,200,255,0.05)';
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  // Earth, in linear colour. Each pixel looks down at the ground, at a distance that
  // grows toward the horizon, so land and cloud foreshorten the way they do from orbit.
  // Close to the limb they're too squeezed to make out, so they blur into an even mix
  // of sea and cloud, and all of it fades into blue haze.
  const ox = Math.random() * 1000;
  const oy = Math.random() * 1000;
  const OCEAN = [0.012, 0.05, 0.17];
  const CLOUD = [1.4, 1.4, 1.45];
  const HAZE = [0.35, 0.62, 1.1];
  const FAR = OCEAN.map((v, c) => v + (CLOUD[c] - v) * 0.3);
  const earth = (x: number, depth: number, out: number[]) => {
    const detail = smoothstep(1.5, 8, depth);
    const haze = Math.exp(-depth / 9);
    out[0] = FAR[0];
    out[1] = FAR[1];
    out[2] = FAR[2];
    if (detail > 0) {
      const az = (x / w) * Math.PI * 2;
      const dist = 1 / Math.tan(THREE.MathUtils.degToRad(depth));
      const gx = Math.cos(az) * dist;
      const gz = Math.sin(az) * dist;
      const land = smoothstep(0.55, 0.58, fbm(gx * 0.8 + ox, gz * 0.8 + oy));
      const dry = fbm(gx * 2 + oy, gz * 2 + ox);
      // Cloud is warped by a second noise, which draws it out into streaks and swirls.
      const cloud = smoothstep(0.5, 0.7, fbm(gx * 1.5 + 2 * fbm(gx * 0.7 + 5, gz * 0.7) + oy, gz * 1.5 + ox));
      const ground = [0.05 + dry * 0.17, 0.08 + dry * 0.07, 0.02 + dry * 0.03];
      for (let c = 0; c < 3; c++) {
        let v = OCEAN[c] + (ground[c] - OCEAN[c]) * land;
        v += (CLOUD[c] - v) * cloud;
        out[c] += (v - out[c]) * detail;
      }
    }
    for (let c = 0; c < 3; c++) out[c] += (HAZE[c] - out[c]) * haze;
  };

  // Combine into half floats. Rows run bottom up in the texture, so they're flipped.
  // Most sky pixels have nothing in the bright layer and come straight from a lookup.
  const decode = Array.from({ length: 256 }, (_, i) => {
    const c = i / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const half = decode.map(v => THREE.DataUtils.toHalfFloat(v));
  const one = THREE.DataUtils.toHalfFloat(1);
  const limbs = Array.from({ length: w }, (_, x) => limbDeg(x));

  // Earth is soft enough to work out at half resolution and fill in between, which
  // quarters the cost of the noise. Above the limb it's plain haze, so filling in along
  // the limb blends haze with haze.
  const ew = w / 2;
  const eh = h / 2;
  const map = new Float32Array(ew * eh * 3);
  const rgb = [0, 0, 0];
  for (let y = 0; y < eh; y++) {
    const elev = 90 - ((y + 0.5) / eh) * 180;
    for (let x = 0; x < ew; x++) {
      const px = (x + 0.5) * 2;
      earth(px, Math.max(0, limbDeg(px) - elev), rgb);
      map.set(rgb, (y * ew + x) * 3);
    }
  }
  const sampleEarth = (x: number, y: number, out: number[]) => {
    const fx = (x + 0.5) / 2 - 0.5;
    const fy = THREE.MathUtils.clamp((y + 0.5) / 2 - 0.5, 0, eh - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    // Across wraps round; down stops at the bottom row.
    const xa = (x0 + ew) % ew;
    const xb = (x0 + 1) % ew;
    const yb = Math.min(eh - 1, y0 + 1);
    for (let c = 0; c < 3; c++) {
      const top = map[(y0 * ew + xa) * 3 + c] * (1 - tx) + map[(y0 * ew + xb) * 3 + c] * tx;
      const bottom = map[(yb * ew + xa) * 3 + c] * (1 - tx) + map[(yb * ew + xb) * 3 + c] * tx;
      out[c] = top + (bottom - top) * ty;
    }
  };

  const data = new Uint16Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const elev = 90 - ((y + 0.5) / h) * 180;
    for (let x = 0, i = y * w * 4, o = (h - 1 - y) * w * 4; x < w; x++, i += 4, o += 4) {
      const depth = limbs[x] - elev;
      if (depth > 0) {
        sampleEarth(x, y, rgb);
        for (let c = 0; c < 3; c++) data[o + c] = THREE.DataUtils.toHalfFloat(rgb[c] + (light[i + c] / 255) * GAIN);
      } else {
        for (let c = 0; c < 3; c++) {
          data[o + c] = light[i + c] ? THREE.DataUtils.toHalfFloat(decode[base[i + c]] + (light[i + c] / 255) * GAIN) : half[base[i + c]];
        }
      }
      data[o + 3] = one;
    }
  }

  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
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
  const beacon = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null!);
  const cur = useRef({ x: 0, y: 0 });
  const anchor = useMemo(() => new THREE.Vector3(), []);
  const grips = useMemo(() => gripGeometry(), []);
  // Built once and kept across a switch to the lite path. It takes a moment to paint,
  // and that switch happens when the device is already struggling.
  const orbit = useMemo(() => visorEnvironment(), []);

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
    // The sun visor is a gold mirror under a clear coat: the gold reflects the view from
    // orbit tinted gold, and the coat adds a faint white reflection that strengthens
    // toward the rim. It has its own environment, so the lite path, which has no studio
    // light, gets the reflections too.
    const gold = { color: GOLD, metalness: 1, roughness: 0.06, envMap: orbit };
    return {
      shell: gloss(SHELL, 0.4, { clearcoat: 1, clearcoatRoughness: 0.25 }),
      trim: gloss(SAFFRON, 0.38, { clearcoat: 0.6, clearcoatRoughness: 0.3 }),
      ring: gloss(RING, 0.5, { clearcoat: 0.5 }),
      metal: gloss(METAL, 0.35, { metalness: 0.6, clearcoat: 0.3 }),
      navy: gloss(NAVY, 0.3, { clearcoat: 1, clearcoatRoughness: 0.1 }),
      white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      // The padded inside of the helmet, in case it shows past the visor's edge.
      lining: new THREE.MeshStandardMaterial({
        color: INTERIOR,
        roughness: 0.9,
        side: THREE.BackSide,
      }),
      gold: lite
        ? new THREE.MeshStandardMaterial(gold)
        : new THREE.MeshPhysicalMaterial({ ...gold, clearcoat: 1, clearcoatRoughness: 0.03 }),
      lamp: new THREE.MeshBasicMaterial({ color: LAMP }),
      // Clear glass over the lamps, there for its highlights.
      lens: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.05,
        transparent: true,
        opacity: 0.3,
      }),
      // The antenna's tip glows, and brightens when it flashes.
      beacon: new THREE.MeshStandardMaterial({
        color: SAFFRON,
        emissive: SAFFRON,
        emissiveIntensity: 0.3,
        roughness: 0.3,
      }),
    };
  }, [lite, orbit]);

  useEffect(() => () => Object.values(mats).forEach(m => m.dispose()), [mats]);
  useEffect(
    () => () => {
      orbit.dispose();
      grips.dispose();
    },
    [orbit, grips],
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
    // A sharp flash that fades quickly. Reduced motion keeps it steadily lit.
    const flash = (clock.elapsedTime % BEACON_S) / BEACON_S;
    beacon.current.material.emissiveIntensity = b.reduced ? 0.8 : 0.3 + 2.2 * Math.exp(-flash * 14);
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
      {/* the tops of the shoulders, cut off by the bottom of the canvas: torso, the neck
          ring with its latches, and a bearing ring between it and the helmet */}
      <group ref={body}>
        <mesh position={[0, -1.55, 0]} scale={[1.35, 1, 0.9]} material={mats.shell}>
          <capsuleGeometry args={[0.62, 0.5, 12, seg(48)]} />
        </mesh>
        <mesh position={[0, -0.93, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.ring}>
          <torusGeometry args={[0.5, 0.09, 24, seg(64)]} />
        </mesh>
        <mesh position={[0, -0.85, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.metal}>
          <torusGeometry args={[0.46, 0.03, 12, seg(64)]} />
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
        {/* helmet: shell open at the front, padded lining, bezel round the opening, and a
            mission patch on the side: the Astrayuga planet and its ring on navy, in a
            saffron border */}
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
          <group position={PATCH.position} quaternion={PATCH.quaternion}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.navy}>
              <cylinderGeometry args={[0.1, 0.1, 0.016, 32]} />
            </mesh>
            <mesh position={[0, 0, 0.008]} material={mats.trim}>
              <torusGeometry args={[0.1, 0.012, 8, 32]} />
            </mesh>
            <mesh position={[0, 0, 0.014]} material={mats.trim}>
              <sphereGeometry args={[0.032, 16, 16]} />
            </mesh>
            <group position={[0, 0, 0.014]} rotation={[0, 0, -0.35]}>
              <mesh rotation={[1.2, 0, 0]} material={mats.white}>
                <torusGeometry args={[0.058, 0.006, 6, 32]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* visor hinge caps with grip ridges round the rim and a metal hub */}
        {SIDES.map(side => (
          <group key={side} position={[side * 0.97, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh material={mats.trim}>
              <cylinderGeometry args={[0.2, 0.2, 0.16, seg(48)]} />
            </mesh>
            <mesh geometry={grips} material={mats.trim} />
            <mesh material={mats.metal}>
              <cylinderGeometry args={[0.09, 0.09, 0.2, 24]} />
            </mesh>
          </group>
        ))}

        {/* head lamps: housing, metal bezel, the lamp, and a glass lens bulging over it */}
        {LAMPS.map(({ side, position, quaternion }) => (
          <group key={side} position={position} quaternion={quaternion}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.ring}>
              <cylinderGeometry args={[0.085, 0.1, 0.1, 24]} />
            </mesh>
            <mesh position={[0, 0, 0.05]} material={mats.metal}>
              <torusGeometry args={[0.072, 0.012, 8, 24]} />
            </mesh>
            <mesh position={[0, 0, 0.051]} material={mats.lamp}>
              <circleGeometry args={[0.062, 24]} />
            </mesh>
            <mesh position={[0, 0, 0.018]} rotation={[Math.PI / 2, 0, 0]} material={mats.lens}>
              <sphereGeometry args={[0.07, 24, 8, 0, Math.PI * 2, 0, 1.08]} />
            </mesh>
          </group>
        ))}

        {/* antenna: a mount, a thick lower mast, a collar, a thin whip, and a beacon */}
        <group ref={antenna} position={[1.02, 0.12, 0]} rotation={[0, 0, -0.35]}>
          <mesh position={[0, 0.02, 0]} material={mats.metal}>
            <cylinderGeometry args={[0.045, 0.055, 0.06, 20]} />
          </mesh>
          <mesh position={[0, 0.13, 0]} material={mats.ring}>
            <cylinderGeometry args={[0.022, 0.022, 0.18, 12]} />
          </mesh>
          <mesh position={[0, 0.22, 0]} material={mats.metal}>
            <cylinderGeometry args={[0.03, 0.03, 0.025, 16]} />
          </mesh>
          <mesh position={[0, 0.33, 0]} material={mats.ring}>
            <cylinderGeometry args={[0.012, 0.016, 0.22, 10]} />
          </mesh>
          <mesh ref={beacon} position={[0, 0.46, 0]} material={mats.beacon}>
            <sphereGeometry args={[0.055, seg(32), seg(32)]} />
          </mesh>
        </group>

        {/* the gold sun visor, its rim, pull tabs, and an arm back to a pivot on each side.
            The arms are strips of the shell that narrow to the pivot. */}
        <group scale={HELMET}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.gold}>
            <sphereGeometry args={[SUN.r, seg(96), seg(48), 0, Math.PI * 2, 0, SUN.cap]} />
          </mesh>
          <mesh position={[0, 0, SUN.r * Math.cos(SUN.cap)]} material={mats.ring}>
            <torusGeometry args={[SUN.r * Math.sin(SUN.cap), 0.02, 12, seg(72)]} />
          </mesh>
          {TABS.map(a => (
            <group key={a} rotation={[0, 0, a]}>
              <RoundedBox
                args={a ? [0.1, 0.05, 0.026] : [0.16, 0.06, 0.03]}
                radius={0.012}
                position={[0, -Math.sin(SUN_TAB) * (SUN.r + 0.008), Math.cos(SUN_TAB) * (SUN.r + 0.008)]}
                rotation={[SUN_TAB, 0, 0]}
                material={mats.trim}
              />
            </group>
          ))}
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
