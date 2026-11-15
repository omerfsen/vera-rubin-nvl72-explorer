import { useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { InstancedMesh, Object3D, Quaternion, Vector3 } from 'three';

export type Vec = [number, number, number];
export interface Segment {
  from: Vec;
  to: Vec;
}

const scratch = new Object3D();
const ALONG = new Vector3(0, 0, 1);

/** Thin rods between point pairs, in any direction, as one InstancedMesh (WebGL lines are only 1 px wide). */
export function Rods({ list, color, opacity, thickness = 0.012 }: { list: Segment[]; color: string; opacity: number; thickness?: number }) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dir = new Vector3();
    const q = new Quaternion();
    list.forEach((s, i) => {
      dir.set(s.to[0] - s.from[0], s.to[1] - s.from[1], s.to[2] - s.from[2]);
      const length = dir.length();
      q.setFromUnitVectors(ALONG, dir.normalize());
      scratch.position.set((s.from[0] + s.to[0]) / 2, (s.from[1] + s.to[1]) / 2, (s.from[2] + s.to[2]) / 2);
      scratch.quaternion.copy(q);
      scratch.scale.set(thickness, thickness, length);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [list, invalidate, thickness]);
  if (list.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </instancedMesh>
  );
}
