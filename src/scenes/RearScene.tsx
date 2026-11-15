import { useSceneTheme } from './useSceneTheme';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Color, InstancedMesh, Object3D } from 'three';
import { Rods } from './Rods';
import { model } from '../data';
import type { RearPart } from '../data/types';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';
import { FRAME_WIDTH, HOVER_COLOR, LINK_COLORS, REAR_COLORS, REAR_STYLE, RU, SELECTED_COLOR, UNIT_DEPTH, UNIT_WIDTH } from './geometry';

/** Parts drawn see-through (the rear bezel) and under the rack (seismic bracing), from data/display.json. */
const SEE_THROUGH = REAR_STYLE.seeThrough as Record<string, number>;
const UNDER_RACK = new Set<string>(REAR_STYLE.underRack);
const DEPTH = REAR_STYLE.depthByType as Record<string, number>;
/** The NVLink fabric from the data: which unit types it joins, through which rear part. */
const FABRIC = model.topology.nvlinkFabric;

const DRAG_THRESHOLD = 6;
/** Rear parts stand well behind the units so the connections between them are visible. */
const REAR_Z = -UNIT_DEPTH / 2 - 0.24;
const BACK_FACE = -UNIT_DEPTH / 2;
const scratch = new Object3D();

type Vec = [number, number, number];

/** Vertical extent (top y, bottom y) of a rear part: a span between units, or a short piece at the top, bottom or below. */
function partY(part: RearPart): [number, number] {
  const top = (model.totalRU * RU) / 2;
  if (part.at) {
    const h = (part.heightRU ?? 1) * RU;
    if (part.at === 'top') return [top, top - h];
    if (part.at === 'bottom') return [-top + h, -top];
    return [-top - 0.02, -top - 0.02 - h]; // below the stack
  }
  const unitTop = (key: string) => top - (model.rackUnitByKey.get(key)?.topRU ?? 0) * RU;
  const unitBottom = (key: string) => {
    const u = model.rackUnitByKey.get(key);
    return u ? top - (u.topRU + u.heightRU) * RU : -top;
  };
  const from = part.from ?? 'top';
  const to = part.to ?? 'bottom';
  return [from === 'top' ? top : unitTop(from), to === 'bottom' ? -top : unitBottom(to)];
}

/** Depth and z position per rear part type. */
function partDepth(part: RearPart): { depth: number; z: number } {
  const type = model.getComponent(part.component)?.type ?? '';
  if (part.component in SEE_THROUGH) return { depth: 0.01, z: REAR_Z - 0.2 };
  if (UNDER_RACK.has(part.component)) return { depth: UNIT_DEPTH + 0.5, z: -0.2 };
  const depth = DEPTH[type] ?? DEPTH.default ?? 0.05;
  // Structure sits behind the cartridges; everything else in the rear plane.
  return { depth, z: type === 'structure' ? REAR_Z - 0.13 : REAR_Z - depth / 2 };
}

export interface RearBox {
  part: RearPart;
  /** Position in the data's rearLayout.parts list. */
  partIndex: number;
  path: string;
  layer: 'parts' | 'structure';
  position: Vec;
  size: Vec;
}

/** Boxes for every rear part in the data's rear layout. */
export function rearBoxes(): RearBox[] {
  return (model.topology.rearLayout?.parts ?? []).map((part, partIndex) => {
    const [yTop, yBottom] = partY(part);
    const { depth, z } = partDepth(part);
    return {
      part,
      partIndex,
      path: model.pathForComponent(part.component) + (part.index ? `.${part.index}` : ''),
      layer: part.layer ?? 'parts',
      position: [part.x * FRAME_WIDTH, (yTop + yBottom) / 2, z],
      size: [part.w * FRAME_WIDTH, yTop - yBottom, depth],
    };
  });
}

interface Clickable {
  path: string;
  position: Vec;
  size: Vec;
}

/** Instanced, clickable boxes with per-instance colour, hover and selection. */
function ClickableBoxes({ items, colorOf }: { items: Clickable[]; colorOf: (i: number) => string }) {
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
    items.forEach((b, i) => {
      scratch.position.set(...b.position);
      scratch.quaternion.identity();
      scratch.scale.set(...b.size);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
      if (selected === b.path || selected.replace(/\.\d+$/, '') === b.path) color.set(SELECTED_COLOR);
      else if (hovered === b.path) color.set(HOVER_COLOR);
      else color.set(colorOf(i));
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [items, selected, hovered, invalidate, colorOf]);

  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
  );
  const pathOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId === undefined ? null : (items[e.instanceId]?.path ?? null));
  if (items.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, items.length]}
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

export interface UnitConnectorBox extends Clickable {
  kind: string;
  unitKey: string;
  toPart?: number;
}

/** Connector boxes on the back face of every unit, from rearLayout.unitConnectors. */
export function unitConnectorBoxes(): UnitConnectorBox[] {
  const top = (model.totalRU * RU) / 2;
  const out: UnitConnectorBox[] = [];
  for (const c of model.topology.rearLayout?.unitConnectors ?? []) {
    for (const unit of model.rackUnits.filter((u) => u.componentId === c.unit)) {
      const y = top - (unit.topRU + unit.heightRU / 2) * RU;
      const h = Math.min(unit.heightRU * RU * 0.6, RU * 0.6);
      const within = model.pathForComponent(c.component).split('/').slice(1).join('/');
      out.push({
        path: `${unit.key}/${within}${c.index ? `.${c.index}` : ''}`,
        kind: c.kind,
        unitKey: unit.key,
        position: [c.x * UNIT_WIDTH, y, BACK_FACE - 0.015],
        size: [c.w * UNIT_WIDTH, h, 0.03],
        toPart: c.toPart,
      });
    }
  }
  return out;
}

export interface RearSegment {
  kind: string;
  unitKey: string;
  rearPath: string;
  from: Vec;
  to: Vec;
}

/**
 * One rod per unit connector: from the connector to the rear part it plugs
 * into (NVLink to the cartridge, water to a manifold, power to the bus bar),
 * or away from the rack for the AC whips.
 */
export function rearSegments(boxes: RearBox[]): RearSegment[] {
  const segs: RearSegment[] = [];
  for (const c of unitConnectorBoxes()) {
    const start: Vec = [c.position[0], c.position[1], BACK_FACE - 0.03];
    if (c.toPart === undefined) {
      segs.push({ kind: c.kind, unitKey: c.unitKey, rearPath: 'remote-power-panel', from: start, to: [start[0] - 0.12, start[1] - 0.04, REAR_Z - 0.4] });
      continue;
    }
    const box = boxes.find((b) => b.partIndex === c.toPart);
    if (!box) continue;
    segs.push({
      kind: c.kind,
      unitKey: c.unitKey,
      rearPath: box.path,
      from: start,
      to: [box.position[0], c.position[1], box.position[2] + box.size[2] / 2],
    });
  }
  return segs;
}

/**
 * The NVLink fabric through the cartridge for one selected tray: a compute
 * tray reaches all nine switch trays, a switch tray all eighteen compute
 * trays (block diagram, section 1.2 Fig. 4, and section 1.3).
 */
export function fabricSegments(unitKey: string, boxes: RearBox[]): RearSegment[] {
  const unit = model.rackUnitByKey.get(unitKey);
  const cartridge = FABRIC ? boxes.find((b) => b.part.component === FABRIC.through) : undefined;
  if (!unit || !cartridge) return [];
  const [a, b] = FABRIC?.endpoints ?? [];
  const peerType = unit.componentId === a ? b : unit.componentId === b ? a : null;
  if (!peerType) return [];
  const top = (model.totalRU * RU) / 2;
  const yOf = (u: { topRU: number; heightRU: number }) => top - (u.topRU + u.heightRU / 2) * RU;
  const peers = model.rackUnits.filter((u) => u.componentId === peerType);
  const z = cartridge.position[2] - cartridge.size[2] / 2 - 0.01;
  const half = cartridge.size[0] / 2 - 0.02;
  return peers.map((p, i) => {
    const x = cartridge.position[0] - half + ((i + 0.5) / peers.length) * half * 2;
    return { kind: 'nvlink', unitKey, rearPath: p.key, from: [x, yOf(unit), z], to: [x, yOf(p), z] };
  });
}

/** The rack's "veins" behind the units: bright for the selection, faint otherwise, plus the NVLink fan-out. */
function RearLinks({ segments, boxes }: { segments: RearSegment[]; boxes: RearBox[] }) {
  const selected = useExplorer((s) => s.selected);
  const first = selected.split('/')[0] ?? '';
  const kinds = useMemo(() => [...new Set(segments.map((s) => s.kind))], [segments]);
  const fabric = useMemo(() => fabricSegments(first, boxes), [first, boxes]);
  return (
    <group>
      {kinds.flatMap((kind) =>
        [true, false].map((active) => (
          <Rods
            key={`${kind}-${active}`}
            list={segments.filter(
              (s) => s.kind === kind && (selected === '' || s.unitKey === first || s.rearPath === selected) === active,
            )}
            color={LINK_COLORS[kind] ?? '#ffffff'}
            opacity={active ? 0.95 : 0.3}
          />
        )),
      )}
      <Rods list={fabric} color={LINK_COLORS.nvlink ?? '#ffff66'} opacity={0.95} thickness={0.008} />
    </group>
  );
}

/**
 * Labels only for what the pointer is on or what is selected (the legend
 * names every part), plus the selected tray's NVLink fan-out: labelling all
 * rear parts at once piles them up from this angle.
 */
function RearLabels({ boxes, connectors }: { boxes: RearBox[]; connectors: UnitConnectorBox[] }) {
  const connected = useThree((s) => s.events.connected);
  const selected = useExplorer((s) => s.selected);
  const hovered = useExplorer((s) => s.hovered);
  const i18n = useI18n();
  if (!connected) return null;
  const labels: { text: string; position: Vec }[] = [];
  for (const target of new Set([hovered, selected])) {
    if (!target) continue;
    const box = boxes.find((b) => b.path === target) ?? connectors.find((c) => c.path === target);
    if (!box) continue;
    const segs = model.parsePath(target) ?? [];
    const last = segs[segs.length - 1];
    const text = last ? i18n.segmentLabel(last) : target;
    labels.push({ text, position: [box.position[0], box.position[1] + Math.min(box.size[1] / 2, 0.15) + 0.04, box.position[2] - box.size[2] / 2] });
  }
  const unit = model.rackUnitByKey.get(selected.split('/')[0] ?? '');
  const cart = FABRIC ? boxes.find((b) => b.part.component === FABRIC.through) : undefined;
  const peerType = unit && FABRIC ? FABRIC.endpoints.find((e) => e !== unit.componentId && FABRIC.endpoints.includes(unit.componentId)) : undefined;
  if (unit && cart && peerType) {
    const peer = model.getComponent(peerType);
    const count = model.rackUnits.filter((u) => u.componentId === peerType).length;
    const top = (model.totalRU * RU) / 2;
    labels.push({
      text: i18n.t('scene.nvlinkFanout', {
        unit: i18n.segmentLabel({ id: unit.componentId, index: unit.index }),
        count,
        peers: i18n.t(`unitPlural.${peer?.type ?? peerType}`),
      }),
      position: [cart.position[0], top - (unit.topRU + unit.heightRU / 2) * RU + 0.05, cart.position[2] - cart.size[2] / 2 - 0.05],
    });
  }
  return (
    <>
      {labels.map((l) => (
        <Html key={l.text} position={l.position} center className="rear-label" style={{ pointerEvents: 'none' }} zIndexRange={[20, 10]}>
          <span>{l.text}</span>
        </Html>
      ))}
    </>
  );
}

/** Rear parts of the rack, the connectors on every unit's back and the connections between them. */
export function RearScene({ showLabels }: { showLabels: boolean }) {
  const layers = useExplorer((s) => s.layers);
  const { scene } = useSceneTheme();
  const boxes = useMemo(rearBoxes, []);
  const segments = useMemo(() => rearSegments(boxes), [boxes]);
  const connectors = useMemo(unitConnectorBoxes, []);
  const solid = useMemo(
    () => boxes.filter((b) => !(b.part.component in SEE_THROUGH) && (b.layer === 'parts' ? layers.parts : layers.structure)),
    [boxes, layers],
  );
  const bezel = useMemo(() => (layers.structure ? boxes.filter((b) => b.part.component in SEE_THROUGH) : []), [boxes, layers]);
  const colorOfPart = useMemo(
    () => (i: number) => REAR_COLORS[model.getComponent(solid[i]!.part.component)?.type ?? ''] ?? '#666666',
    [solid],
  );
  const colorOfConnector = useMemo(() => (i: number) => LINK_COLORS[connectors[i]!.kind] ?? '#999999', [connectors]);
  return (
    <group>
      <ClickableBoxes items={solid} colorOf={colorOfPart} />
      {bezel.map((b) => (
        <mesh key={b.path} position={b.position} raycast={() => null}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={scene.rearBezel} transparent opacity={REAR_STYLE.seeThrough[b.part.component as keyof typeof REAR_STYLE.seeThrough] ?? 0.2} depthWrite={false} />
        </mesh>
      ))}
      {layers.parts && <ClickableBoxes items={connectors} colorOf={colorOfConnector} />}
      {layers.links && <RearLinks segments={segments} boxes={boxes} />}
      {showLabels && <RearLabels boxes={boxes} connectors={connectors} />}
    </group>
  );
}
