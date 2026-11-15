import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Color, InstancedMesh, Object3D } from 'three';
import { model } from '../data';
import type { TraySlot } from '../data/types';
import { useExplorer } from '../state/store';
import { isPartSelected, partColor } from './colors';
import {
  HOVER_COLOR,
  SELECTED_COLOR,
  TRAY_DEPTH,
  TRAY_HEIGHT,
  TRAY_WIDTH,
  slotBox,
} from './geometry';

/** Pointer travel (px) above which a click counts as a drag. */
const DRAG_THRESHOLD = 6;
const scratch = new Object3D();

interface Placed {
  slot: TraySlot;
  path: string;
}

/** All slots of one component inside the open tray, as one InstancedMesh. */
function PartInstances({ trayKey, items }: { trayKey: string; items: Placed[] }) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const selected = useExplorer((s) => s.selected);
  const hovered = useExplorer((s) => s.hovered);
  const select = useExplorer((s) => s.select);
  const setHovered = useExplorer((s) => s.setHovered);
  const base = useMemo(() => new Color(partColor(items[0]!.slot.component)), [items]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const color = new Color();
    items.forEach((it, i) => {
      const box = slotBox(it.slot);
      const lift = isPartSelected(it.path, selected) && it.slot.face === 'top' ? 0.03 : 0;
      scratch.position.set(box.position[0], box.position[1] + lift, box.position[2]);
      scratch.scale.set(...box.size);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
      if (isPartSelected(it.path, selected)) color.set(SELECTED_COLOR);
      else if (it.path === hovered) color.set(HOVER_COLOR);
      else color.copy(base);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [items, selected, hovered, base, invalidate, trayKey]);

  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
  );

  const pathOf = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId === undefined ? null : (items[e.instanceId]?.path ?? null);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, items.length]}
      onPointerMove={(e) => {
        e.stopPropagation();
        const path = pathOf(e);
        if (path !== hovered) setHovered(path);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = '';
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > DRAG_THRESHOLD) return;
        const path = pathOf(e);
        if (path) select(path);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" metalness={0.3} roughness={0.5} />
    </instancedMesh>
  );
}

/** Base plate, side and rear walls, and the front panel of the open tray. */
function TrayShell() {
  const wall = 0.012;
  const parts: { position: [number, number, number]; size: [number, number, number]; color: string }[] = [
    { position: [0, 0, 0], size: [TRAY_WIDTH, 0.01, TRAY_DEPTH], color: '#23282f' },
    { position: [-TRAY_WIDTH / 2, TRAY_HEIGHT / 2, 0], size: [wall, TRAY_HEIGHT, TRAY_DEPTH], color: '#3a4049' },
    { position: [TRAY_WIDTH / 2, TRAY_HEIGHT / 2, 0], size: [wall, TRAY_HEIGHT, TRAY_DEPTH], color: '#3a4049' },
    { position: [0, TRAY_HEIGHT / 2, -TRAY_DEPTH / 2], size: [TRAY_WIDTH, TRAY_HEIGHT, wall], color: '#3a4049' },
    { position: [0, TRAY_HEIGHT / 2, TRAY_DEPTH / 2], size: [TRAY_WIDTH, TRAY_HEIGHT, wall], color: '#8b7d5c' },
  ];
  return (
    <group>
      {parts.map((p, i) => (
        <mesh key={i} position={p.position} raycast={() => null}>
          <boxGeometry args={p.size} />
          <meshStandardMaterial color={p.color} metalness={0.3} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** Name shown for a part instance: NVIDIA's label when the layout has one. */
export function partLabel(item: Placed): string {
  const c = model.getComponent(item.slot.component);
  const name = c?.name ?? item.slot.component;
  if (item.slot.label) return item.slot.label;
  return item.slot.index === undefined ? name : `${name} ${item.slot.index}`;
}

function Labels({ placed }: { placed: Placed[] }) {
  const connected = useThree((s) => s.events.connected);
  const hovered = useExplorer((s) => s.hovered);
  if (!connected) return null;
  const hoveredItem = placed.find((p) => p.path === hovered);
  const box = hoveredItem ? slotBox(hoveredItem.slot) : null;
  return (
    <>
      <Html position={[0, 0.02, TRAY_DEPTH / 2 + 0.12]} center className="tray-label" style={{ pointerEvents: 'none' }}>
        <span>Front</span>
      </Html>
      <Html position={[0, 0.02, -TRAY_DEPTH / 2 - 0.12]} center className="tray-label" style={{ pointerEvents: 'none' }}>
        <span>Rear</span>
      </Html>
      {hoveredItem && box && (
        <Html
          position={[box.position[0], box.position[1] + box.size[1] / 2 + 0.04, box.position[2]]}
          center
          className="part-tooltip"
          style={{ pointerEvents: 'none' }}
        >
          <span>{partLabel(hoveredItem)}</span>
        </Html>
      )}
    </>
  );
}

/** The open interior of one compute tray, generated from its tray layout. */
export function ComputeTrayScene({ trayKey }: { trayKey: string }) {
  const trayId = trayKey.split('.')[0]!;
  const layout = model.trayLayout(trayId);
  const groups = useMemo(() => {
    const byComponent = new Map<string, Placed[]>();
    for (const slot of layout?.slots ?? []) {
      const list = byComponent.get(slot.component) ?? [];
      list.push({ slot, path: `${trayKey}/${model.slotPathWithin(trayId, slot)}` });
      byComponent.set(slot.component, list);
    }
    return [...byComponent.entries()];
  }, [layout, trayKey, trayId]);
  const placed = useMemo(() => groups.flatMap(([, items]) => items), [groups]);
  if (!layout) return null;
  return (
    <group>
      <TrayShell />
      {groups.map(([component, items]) => (
        <PartInstances key={component} trayKey={trayKey} items={items} />
      ))}
      <Labels placed={placed} />
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color="#14181d" />
      </mesh>
    </group>
  );
}
