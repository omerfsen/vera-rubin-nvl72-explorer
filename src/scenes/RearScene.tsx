import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D } from 'three';
import { model } from '../data';
import type { RearPart } from '../data/types';
import { useExplorer } from '../state/store';
import { FRAME_WIDTH, HOVER_COLOR, LINK_COLORS, REAR_COLORS, RU, SELECTED_COLOR, UNIT_DEPTH, UNIT_WIDTH } from './geometry';

const DRAG_THRESHOLD = 6;
/** Rear parts stand well behind the units so the connections between them are visible. */
const REAR_Z = -UNIT_DEPTH / 2 - 0.24;
const ROD = 0.012;
const scratch = new Object3D();

/** Vertical extent (top y, bottom y) of a span such as "compute-tray.1" to "compute-tray.18". */
function spanY(from: string, to: string): [number, number] {
  const top = (model.totalRU * RU) / 2;
  const unitTop = (key: string) => top - (model.rackUnitByKey.get(key)?.topRU ?? 0) * RU;
  const unitBottom = (key: string) => {
    const u = model.rackUnitByKey.get(key);
    return u ? top - (u.topRU + u.heightRU) * RU : -top;
  };
  return [from === 'top' ? top : unitTop(from), to === 'bottom' ? -top : unitBottom(to)];
}

export interface RearBox {
  part: RearPart;
  path: string;
  position: [number, number, number];
  size: [number, number, number];
}

/** Boxes for every rear part in the data's rear layout. */
export function rearBoxes(): RearBox[] {
  return (model.topology.rearLayout?.parts ?? []).map((part) => {
    const [yTop, yBottom] = spanY(part.from, part.to);
    const depth = part.component === 'nvlink-cable-cartridge' ? 0.1 : 0.05;
    return {
      part,
      path: model.pathForComponent(part.component) + (part.index ? `.${part.index}` : ''),
      position: [part.x * FRAME_WIDTH, (yTop + yBottom) / 2, REAR_Z - depth / 2],
      size: [part.w * FRAME_WIDTH, yTop - yBottom, depth],
    };
  });
}

function RearParts({ boxes }: { boxes: RearBox[] }) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const selected = useExplorer((s) => s.selected);
  const hovered = useExplorer((s) => s.hovered);
  const select = useExplorer((s) => s.select);
  const setHovered = useExplorer((s) => s.setHovered);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const color = new Color();
    boxes.forEach((b, i) => {
      scratch.position.set(...b.position);
      scratch.scale.set(...b.size);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
      const type = model.getComponent(b.part.component)?.type ?? '';
      if (selected === b.path) color.set(SELECTED_COLOR);
      else if (hovered === b.path) color.set(HOVER_COLOR);
      else color.set(REAR_COLORS[type] ?? '#666666');
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [boxes, selected, hovered, invalidate]);

  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
  );
  const pathOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId === undefined ? null : (boxes[e.instanceId]?.path ?? null));
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, boxes.length]}
      onPointerMove={(e) => {
        e.stopPropagation();
        const p = pathOf(e);
        if (p !== hovered) setHovered(p);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = '';
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > DRAG_THRESHOLD) return;
        const p = pathOf(e);
        if (p) select(p);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" metalness={0.4} roughness={0.5} />
    </instancedMesh>
  );
}

export interface RearSegment {
  kind: string;
  unitKey: string;
  rearPath: string;
  assumed: boolean;
  from: [number, number, number];
  to: [number, number, number];
}

/**
 * One segment per (rack unit, rear part) pair named by a type-level
 * connection in the data, e.g. every compute tray to the cable cartridge.
 */
export function rearSegments(boxes: RearBox[]): RearSegment[] {
  const rearIds = new Set(boxes.map((b) => b.part.component));
  const top = (model.totalRU * RU) / 2;
  const segs: RearSegment[] = [];
  for (const c of model.topology.connections) {
    if (!c.to) continue;
    const [rearId, unitType] = rearIds.has(c.from) ? [c.from, c.to] : rearIds.has(c.to) ? [c.to, c.from] : [null, null];
    if (!rearId || !unitType || !model.isRackUnitType(unitType)) continue;
    for (const unit of model.rackUnits.filter((u) => u.componentId === unitType)) {
      const y = top - (unit.topRU + unit.heightRU / 2) * RU;
      for (const box of boxes.filter((b) => b.part.component === rearId)) {
        const [yTop, yBottom] = [box.position[1] + box.size[1] / 2, box.position[1] - box.size[1] / 2];
        if (y > yTop || y < yBottom) continue;
        const startX = Math.max(-UNIT_WIDTH / 2, Math.min(UNIT_WIDTH / 2, box.position[0] * 0.8));
        segs.push({
          kind: c.kind,
          unitKey: unit.key,
          rearPath: box.path,
          assumed: c.assumed === true,
          from: [startX, y, -UNIT_DEPTH / 2],
          to: [box.position[0], y, box.position[2] + box.size[2] / 2],
        });
      }
    }
  }
  return segs;
}

/**
 * The rack's "veins" behind the units, as thin rods (lines are only 1 px wide
 * in WebGL). Rods of the selected unit or rear part are bright; the rest are
 * faint while something is selected.
 */
function RearLinks({ segments }: { segments: RearSegment[] }) {
  const selected = useExplorer((s) => s.selected);
  const first = selected.split('/')[0] ?? '';
  const kinds = useMemo(() => [...new Set(segments.map((s) => s.kind))], [segments]);
  return (
    <group>
      {kinds.flatMap((kind) =>
        [true, false].map((active) => {
          const list = segments.filter(
            (s) => s.kind === kind && (selected === '' || s.unitKey === first || s.rearPath === selected) === active,
          );
          return list.length === 0 ? null : <Rods key={`${kind}-${active}`} list={list} color={LINK_COLORS[kind] ?? '#ffffff'} faint={!active} />;
        }),
      )}
    </group>
  );
}

function Rods({ list, color, faint }: { list: RearSegment[]; color: string; faint: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    list.forEach((s, i) => {
      const dx = s.to[0] - s.from[0];
      const dz = s.to[2] - s.from[2];
      const length = Math.hypot(dx, dz);
      scratch.position.set((s.from[0] + s.to[0]) / 2, s.from[1], (s.from[2] + s.to[2]) / 2);
      scratch.rotation.set(0, Math.atan2(dx, dz), 0);
      scratch.scale.set(ROD, ROD, length);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    scratch.rotation.set(0, 0, 0);
    invalidate();
  }, [list, invalidate]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={faint ? 0.35 : 0.95} />
    </instancedMesh>
  );
}

/** Rear parts of the rack and the connections from every unit to them. */
export function RearScene() {
  const layers = useExplorer((s) => s.layers);
  const boxes = useMemo(rearBoxes, []);
  const segments = useMemo(() => rearSegments(boxes), [boxes]);
  return (
    <group>
      {layers.parts && <RearParts boxes={boxes} />}
      {layers.links && <RearLinks segments={segments} />}
    </group>
  );
}
