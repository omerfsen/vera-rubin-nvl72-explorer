import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, InstancedMesh, ShaderMaterial } from 'three';
import { useExplorer } from '../state/store';
import { flowShouldAnimate } from './flow';
import { placeRods, type Segment } from './Rods';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(REDUCED_MOTION) : null;
  mq?.addEventListener('change', onChange);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    mq?.removeEventListener('change', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
}

function snapshot(): string {
  const reduced = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(REDUCED_MOTION).matches : false;
  return `${reduced ? 1 : 0}${document.hidden ? 1 : 0}`;
}

/** Live reduced-motion and hidden-tab state; re-renders when either changes. */
export function useMotionState(): { reducedMotion: boolean; hidden: boolean } {
  const state = useSyncExternalStore(subscribe, snapshot, () => '10');
  return { reducedMotion: state[0] === '1', hidden: state[1] === '1' };
}

/** True while the network flow should move: a network is shown, the tab is visible, and motion is not reduced. */
export function useFlowRunning(): boolean {
  const network = useExplorer((s) => s.network);
  return flowShouldAnimate({ network, ...useMotionState() });
}

// Pulses travel along each rod's local z axis (from `from` to `to`). The rod's
// length is the length of the instance matrix's z column, so pulse spacing and
// speed are in metres whatever the rod's length, with no extra attribute.
const VERTEX = /* glsl */ `
varying float vAlong;
varying float vLength;
void main() {
  vAlong = position.z + 0.5;
  vLength = length(instanceMatrix[2].xyz);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uSpacing;
uniform float uSpeed;
uniform float uOpacity;
varying float vAlong;
varying float vLength;
void main() {
  float phase = fract((vAlong * vLength - uTime * uSpeed) / uSpacing);
  float a = smoothstep(0.0, 0.25, phase) * (1.0 - smoothstep(0.3, 0.5, phase));
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor, a * uOpacity);
  #include <colorspace_fragment>
}
`;

/** Pulse spacing (m) and speed (m/s) along every rod. */
const SPACING = 0.05;
const SPEED = 0.07;

function FlowMesh({ list, color, thickness }: { list: Segment[]; color: string; thickness: number }) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        uniforms: {
          // A lighter tint of the network's colour, so the pulses read over the static rods.
          uColor: { value: new Color(color).lerp(new Color('#ffffff'), 0.35) },
          uTime: { value: 0 },
          uSpacing: { value: SPACING },
          uSpeed: { value: SPEED },
          uOpacity: { value: 0.9 },
        },
      }),
    [color],
  );
  useLayoutEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    placeRods(mesh, list, thickness);
    invalidate();
  }, [list, thickness, invalidate]);
  // frameloop="demand": each frame asks for the next one, only while this is mounted.
  useFrame((_, delta) => {
    material.uniforms.uTime!.value += Math.min(delta, 0.1);
    invalidate();
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}

/**
 * Pulses moving along the network overlay's path, drawn over the static rods.
 * Unmounted (so the GPU idles) when no network is shown, the tab is hidden or
 * the viewer prefers reduced motion.
 */
export function FlowRods({ list, color, thickness }: { list: Segment[]; color: string; thickness: number }) {
  const running = useFlowRunning();
  if (!running || list.length === 0) return null;
  return <FlowMesh key={list.length} list={list} color={color} thickness={thickness} />;
}
