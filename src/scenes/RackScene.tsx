import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Color, InstancedMesh, Matrix4, Object3D } from 'three';
import { model } from '../data';
import { useExplorer } from '../state/store';
import {
  FRAME_POST,
  FRAME_WIDTH,
  HOVER_COLOR,
  RU,
  SELECTED_COLOR,
  TYPE_COLORS,
  UNIT_DEPTH,
  UNIT_WIDTH,
  frameHeight,
  unitBoxes,
  type UnitBox,
} from './geometry';

/** How far a selected unit slides out of the rack, in metres. */
const SLIDE_OUT = 0.12;
/** Pointer travel (px) above which a click counts as a drag. */
const DRAG_THRESHOLD = 6;

const boxes = unitBoxes(model.rackUnits, model.totalRU);
const boxByKey = new Map(boxes.map((b) => [b.key, b]));
/** One InstancedMesh per component type that appears in the rack layout. */
const unitTypes = [...new Set(model.rackUnits.map((u) => u.componentId))];

function selectedUnitKey(selected: string): string | null {
  const first = selected.split('/')[0] ?? '';
  return model.rackUnitByKey.has(first) ? first : null;
}

const scratch = new Object3D();

function placeBox(mesh: InstancedMesh, i: number, box: UnitBox, slide: number) {
  scratch.position.set(box.position[0], box.position[1], box.position[2] + slide);
  scratch.scale.set(...box.size);
  scratch.updateMatrix();
  mesh.setMatrixAt(i, scratch.matrix);
}

/** All units of one component type, drawn as a single InstancedMesh. */
function UnitInstances({ componentId }: { componentId: string }) {
  const units = useMemo(() => model.rackUnits.filter((u) => u.componentId === componentId), [componentId]);
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const selected = useExplorer((s) => s.selected);
  const hovered = useExplorer((s) => s.hovered);
  const select = useExplorer((s) => s.select);
  const setHovered = useExplorer((s) => s.setHovered);
  const selectedKey = selectedUnitKey(selected);
  const type = model.getComponent(componentId)?.type;
  const base = useMemo(() => new Color(TYPE_COLORS[type ?? 'rack'] ?? '#666666'), [type]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const color = new Color();
    units.forEach((u, i) => {
      const box = boxByKey.get(u.key)!;
      placeBox(mesh, i, box, u.key === selectedKey ? SLIDE_OUT : 0);
      if (u.key === selectedKey) color.set(SELECTED_COLOR);
      else if (u.key === hovered) color.set(HOVER_COLOR);
      else color.copy(base);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [units, selectedKey, hovered, base, invalidate]);

  const keyOf = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId === undefined ? null : (units[e.instanceId]?.key ?? null);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, units.length]}
      onPointerMove={(e) => {
        e.stopPropagation();
        const key = keyOf(e);
        if (key !== hovered) setHovered(key);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = '';
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > DRAG_THRESHOLD) return;
        const key = keyOf(e);
        if (key) select(key);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" metalness={0.35} roughness={0.55} />
    </instancedMesh>
  );
}

/** Two front handles per unit. Decoration only, so it ignores the pointer. */
function Handles() {
  const ref = useRef<InstancedMesh>(null);
  const selected = useExplorer((s) => s.selected);
  const invalidate = useThree((s) => s.invalidate);
  const selectedKey = selectedUnitKey(selected);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    boxes.forEach((b, i) => {
      const slide = b.key === selectedKey ? SLIDE_OUT : 0;
      const h = Math.min(b.size[1] * 0.6, RU * 0.6);
      for (const side of [0, 1] as const) {
        const x = (side === 0 ? -1 : 1) * (UNIT_WIDTH / 2 - 0.018);
        m.makeScale(0.012, h, 0.02);
        m.setPosition(x, b.position[1], UNIT_DEPTH / 2 + 0.01 + slide);
        mesh.setMatrixAt(i * 2 + side, m);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [selectedKey, invalidate]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, boxes.length * 2]} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#c9ced6" metalness={0.6} roughness={0.35} />
    </instancedMesh>
  );
}

/** Four corner posts plus top and bottom plates. */
function RackFrame() {
  const height = frameHeight(model.totalRU);
  const halfW = FRAME_WIDTH / 2 - FRAME_POST / 2;
  const halfD = UNIT_DEPTH / 2 + 0.05;
  const posts: [number, number][] = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD],
  ];
  return (
    <group raycast={() => null}>
      {posts.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0, z]} raycast={() => null}>
          <boxGeometry args={[FRAME_POST, height, FRAME_POST]} />
          <meshStandardMaterial color="#1c2026" metalness={0.4} roughness={0.7} />
        </mesh>
      ))}
      {[height / 2, -height / 2].map((y) => (
        <mesh key={y} position={[0, y, 0]} raycast={() => null}>
          <boxGeometry args={[FRAME_WIDTH, 0.03, halfD * 2 + FRAME_POST]} />
          <meshStandardMaterial color="#1c2026" metalness={0.4} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** "10 x Compute tray" style labels beside each layout group. */
function GroupLabels() {
  const groups = model.topology.rackLayout.groups;
  // drei's <Html> attaches to the canvas parent, which is not in the DOM on
  // the very first commit; mount the labels one tick later so none is lost.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return (
    <>
      {groups.map((g, gi) => {
        const units = model.rackUnits.filter((u) => u.group === gi);
        const first = boxByKey.get(units[0]!.key)!;
        const last = boxByKey.get(units[units.length - 1]!.key)!;
        const y = (first.position[1] + last.position[1]) / 2;
        const name = model.getComponent(g.component)?.name ?? g.component;
        return (
          <Html
            key={gi}
            position={[-FRAME_WIDTH / 2 - 0.04, y, UNIT_DEPTH / 2]}
            center={false}
            className="group-label"
            zIndexRange={[20, 10]}
          >
            <span>
              {g.count} × {name}
            </span>
          </Html>
        );
      })}
    </>
  );
}

export default function RackScene() {
  const height = frameHeight(model.totalRU);
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [0.75, 0.3, 3.2], fov: 38, near: 0.05, far: 50 }}
      aria-label="3D view of the rack. Use the list view or the arrow keys to select units."
      onPointerMissed={() => useExplorer.getState().setHovered(null)}
    >
      <color attach="background" args={['#0e1115']} />
      <hemisphereLight args={['#dfe7f2', '#1a1d22', 0.9]} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.6} />
      <directionalLight position={[-3, 1, -2]} intensity={0.4} />
      <RackFrame />
      {unitTypes.map((id) => (
        <UnitInstances key={id} componentId={id} />
      ))}
      <Handles />
      <GroupLabels />
      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        enableDamping={false}
        minDistance={1.2}
        maxDistance={6}
        maxPolarAngle={Math.PI * 0.85}
      />
      <mesh position={[0, -height / 2 - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color="#14181d" />
      </mesh>
    </Canvas>
  );
}
