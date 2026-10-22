import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { sunAt, towardSun } from '../../lib/sun';

const WHITE = new THREE.Color('#ffffff');
const SKY = new THREE.Color('#ffffff');
const GROUND = new THREE.Color('#e8e1d4');
// Sunlight is near white overhead and deep orange on the horizon. The sky's fill warms
// with it at golden hour and turns a dim blue in twilight.
const SUN_HIGH = new THREE.Color('#fff6e8');
const SUN_LOW = new THREE.Color('#ff8a48');
const SKY_LOW = new THREE.Color('#ffd4b4');
const SKY_DUSK = new THREE.Color('#aab4e0');
const GROUND_LOW = new THREE.Color('#e8c9b0');
const GROUND_DUSK = new THREE.Color('#8a86a8');

// The key light, and the sky's fill. In dark mode they're the fixed studio setup, with
// the key up to the right, where the sun is in the visor's reflection. In light mode the
// key is the page's sun, and the fill and the studio reflections follow the time of day.
export default function Sunlight({ day, lite }: { day: boolean; lite: boolean }) {
  const sky = useRef<THREE.HemisphereLight>(null!);
  const key = useRef<THREE.DirectionalLight>(null!);
  // Without reflections the lite path needs more fill light to stay bright.
  const fill = lite ? 2 : 1.1;

  useFrame(({ scene }) => {
    const k = key.current;
    const h = sky.current;
    if (!day) {
      k.position.set(3, 4, 5);
      k.color.copy(WHITE);
      k.intensity = 1.5;
      h.color.copy(SKY);
      h.groundColor.copy(GROUND);
      h.intensity = fill;
      scene.environmentIntensity = 1;
      return;
    }
    const s = sunAt(performance.now());
    towardSun(s, k.position);
    k.color.lerpColors(SUN_HIGH, SUN_LOW, s.warmth);
    k.intensity = 1.6 * s.light;
    h.color.lerpColors(SKY, SKY_LOW, s.warmth).lerp(SKY_DUSK, s.dusk);
    h.groundColor.lerpColors(GROUND, GROUND_LOW, s.warmth).lerp(GROUND_DUSK, s.dusk);
    h.intensity = fill * (1 - 0.35 * s.dusk);
    scene.environmentIntensity = 1 - 0.3 * s.dusk;
  });

  return (
    <>
      <hemisphereLight ref={sky} args={['#ffffff', '#e8e1d4', fill]} />
      <directionalLight ref={key} position={[3, 4, 5]} intensity={1.5} />
    </>
  );
}
