import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { skyAt, toward } from '../../lib/sky';

const SKY = new THREE.Color('#ffffff');
const GROUND = new THREE.Color('#e8e1d4');
// Sunlight is near white overhead and deep orange on the horizon, and the sky's fill
// warms with it at golden hour. Moonlight is dimmer and cool, going amber when the moon
// is low, and the night's fill is a dim blue.
const SUN_HIGH = new THREE.Color('#fff6e8');
const SUN_LOW = new THREE.Color('#ff8a48');
const MOON_HIGH = new THREE.Color('#cdd8ff');
const MOON_LOW = new THREE.Color('#ffc890');
const SKY_LOW = new THREE.Color('#ffd4b4');
const SKY_NIGHT = new THREE.Color('#9eaee6');
const GROUND_LOW = new THREE.Color('#e8c9b0');
const GROUND_NIGHT = new THREE.Color('#4a4660');

// The key light and the sky's fill, on the sky's clock (lib/sky.ts). By day the key is
// the sun, by night the full moon, each crossing from left to right the way it crosses
// the page. The fill and the studio reflections dim and cool as the daylight goes.
export default function Lighting({ lite }: { lite: boolean }) {
  const sky = useRef<THREE.HemisphereLight>(null!);
  const key = useRef<THREE.DirectionalLight>(null!);
  // Without reflections the lite path needs more fill light to stay bright.
  const fill = lite ? 2 : 1.1;

  useFrame(({ scene }) => {
    const { night, sun, moon, dark } = skyAt(performance.now());
    const k = key.current;
    const h = sky.current;
    if (night) {
      toward(moon, k.position);
      k.color.lerpColors(MOON_HIGH, MOON_LOW, moon.warmth);
      k.intensity = 1.1 * moon.light;
    } else {
      toward(sun, k.position);
      k.color.lerpColors(SUN_HIGH, SUN_LOW, sun.warmth);
      k.intensity = 1.6 * sun.light;
    }
    h.color.lerpColors(SKY, SKY_LOW, sun.warmth).lerp(SKY_NIGHT, dark);
    h.groundColor.lerpColors(GROUND, GROUND_LOW, sun.warmth).lerp(GROUND_NIGHT, dark);
    h.intensity = fill * (1 - 0.25 * dark);
    scene.environmentIntensity = 1 - 0.2 * dark;
  });

  return (
    <>
      <hemisphereLight ref={sky} args={['#ffffff', '#e8e1d4', fill]} />
      <directionalLight ref={key} position={[3, 4, 5]} intensity={1.5} />
    </>
  );
}
