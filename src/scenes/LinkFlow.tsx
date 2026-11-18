import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, type Curve, InstancedMesh, Object3D, Vector3 } from 'three';
import { dotFraction } from './flow';

/** Dots per link, their speed (m/s) and radius (m). */
export const DOTS_PER_LINK = 4;
const SPEED = 0.06;
const DOT_RADIUS = 0.0075;
const scratch = new Object3D();

export interface FlowLink {
  curve: Curve<Vector3>;
  color: string;
}

/** Positions of every dot at time `t`: `n` per curve, curve by curve, evenly spread by arc length. */
export function flowDotPositions(curves: readonly Curve<Vector3>[], t: number, n = DOTS_PER_LINK, speed = SPEED): Vector3[] {
  return curves.flatMap((curve) => {
    const length = curve.getLength();
    return Array.from({ length: n }, (_, k) => curve.getPointAt(dotFraction(t, k, n, speed, length)));
  });
}

function Dots({ links }: { links: FlowLink[] }) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const time = useRef(0);
  const curves = useMemo(() => links.map((l) => l.curve), [links]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const c = new Color();
    links.forEach((l, j) => {
      // A lighter tint of the link's own colour, so the dots read over the tube in either theme.
      c.set(l.color).lerp(new Color('#ffffff'), 0.55);
      for (let k = 0; k < DOTS_PER_LINK; k++) mesh.setColorAt(j * DOTS_PER_LINK + k, c);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [links, invalidate]);
  // frameloop="demand": each frame asks for the next one, only while this is mounted.
  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    time.current += Math.min(delta, 0.1);
    flowDotPositions(curves, time.current).forEach((p, i) => {
      scratch.position.copy(p);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, links.length * DOTS_PER_LINK]} raycast={() => null} frustumCulled={false}>
      <sphereGeometry args={[DOT_RADIUS, 6, 4]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </instancedMesh>
  );
}

/**
 * Dots moving along the shown connections. The caller mounts it only while
 * motion is allowed, so the canvas goes idle again when it unmounts.
 */
export function LinkFlow({ links }: { links: FlowLink[] }) {
  if (links.length === 0) return null;
  return <Dots key={links.length} links={links} />;
}
