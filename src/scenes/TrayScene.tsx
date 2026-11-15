import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, QuadraticBezierLine } from '@react-three/drei';
import { Color, InstancedMesh, Object3D } from 'three';
import { model } from '../data';
import type { LinkEnd, TrayLayout, TraySlot } from '../data/types';
import { useExplorer } from '../state/store';
import { i18nFor, useI18n, type I18n } from '../i18n';
import { isPartSelected, partColor } from './colors';
import {
  CONFLICT_COLOR,
  DIM_COLOR,
  HOVER_COLOR,
  LED_COLORS,
  NETWORK_COLORS,
  LINK_COLORS,
  SCENE_COLORS,
  SELECTED_COLOR,
  TYPE_COLORS,
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
function PartInstances({ trayKey, items, heightRU }: { trayKey: string; items: Placed[]; heightRU: number }) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const selected = useExplorer((s) => s.selected);
  const hovered = useExplorer((s) => s.hovered);
  const select = useExplorer((s) => s.select);
  const setHovered = useExplorer((s) => s.setHovered);
  const network = useExplorer((s) => s.network);
  const base = useMemo(() => new Color(partColor(items[0]!.slot.component)), [items]);
  // With the network overlay on, parts on the network take its colour (or the
  // conflict colour), and everything else is dimmed.
  const overlay = useMemo(() => {
    if (!network) return null;
    const m = model.networkMembers(network).members.get(items[0]!.slot.component);
    return m ? (m.alternative ? CONFLICT_COLOR : (NETWORK_COLORS[network] ?? '#ffffff')) : DIM_COLOR;
  }, [network, items]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const color = new Color();
    items.forEach((it, i) => {
      const box = slotBox(it.slot, heightRU);
      const lift = isPartSelected(it.path, selected) && it.slot.face === 'top' ? 0.03 : 0;
      scratch.position.set(box.position[0], box.position[1] + lift, box.position[2]);
      scratch.scale.set(...box.size);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
      if (isPartSelected(it.path, selected)) color.set(SELECTED_COLOR);
      else if (it.path === hovered) color.set(HOVER_COLOR);
      else if (overlay) color.set(overlay);
      else color.copy(base);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [items, selected, hovered, base, invalidate, trayKey, heightRU, overlay]);

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
function TrayShell({ heightRU, frontColor }: { heightRU: number; frontColor: string }) {
  const wall = 0.012;
  const TRAY_HEIGHT_RU = TRAY_HEIGHT * heightRU;
  const frontHeight = heightRU > 1 ? TRAY_HEIGHT * 0.12 : TRAY_HEIGHT_RU;
  const parts: { position: [number, number, number]; size: [number, number, number]; color: string }[] = [
    { position: [0, 0, 0], size: [TRAY_WIDTH, 0.01, TRAY_DEPTH], color: SCENE_COLORS.trayBase },
    { position: [-TRAY_WIDTH / 2, TRAY_HEIGHT_RU / 2, 0], size: [wall, TRAY_HEIGHT_RU, TRAY_DEPTH], color: SCENE_COLORS.trayWall },
    { position: [TRAY_WIDTH / 2, TRAY_HEIGHT_RU / 2, 0], size: [wall, TRAY_HEIGHT_RU, TRAY_DEPTH], color: SCENE_COLORS.trayWall },
    { position: [0, TRAY_HEIGHT_RU / 2, -TRAY_DEPTH / 2], size: [TRAY_WIDTH, TRAY_HEIGHT_RU, wall], color: SCENE_COLORS.trayWall },
    // The front of a tall shelf is mostly its parts (PSUs), so only a low lip is drawn there.
    { position: [0, frontHeight / 2, TRAY_DEPTH / 2], size: [TRAY_WIDTH, frontHeight, wall], color: frontColor },
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

type Vec = [number, number, number];

/** Status LEDs on the front face of parts that have them (PSUs, the management module). */
function Indicators({ layout }: { layout: TrayLayout }) {
  const heightRU = layout.heightRU ?? 1;
  const leds = layout.slots.flatMap((slot) =>
    (slot.indicators ?? []).map((led, k) => {
      const box = slotBox(slot, heightRU);
      const s = Math.min(0.02, box.size[1] * 0.18);
      const position: Vec = [
        box.position[0] - box.size[0] / 2 + s * (1.4 + k * 2),
        box.position[1] + box.size[1] / 2 - s * 1.4,
        box.position[2] + box.size[2] / 2 + 0.003,
      ];
      return { key: `${slot.component}.${slot.index ?? 0}.${k}`, position, s, color: LED_COLORS[led.color] ?? '#ffffff' };
    }),
  );
  return (
    <group>
      {leds.map((l) => (
        <mesh key={l.key} position={l.position} raycast={() => null}>
          <boxGeometry args={[l.s, l.s, 0.004]} />
          <meshBasicMaterial color={l.color} />
        </mesh>
      ))}
    </group>
  );
}

/** Where a link attaches: the top centre of a part, or a named point on the tray floor. */
function endPosition(layout: TrayLayout, end: LinkEnd): Vec | null {
  const heightRU = layout.heightRU ?? 1;
  if (end.point !== undefined) {
    const p = layout.points?.find((pt) => pt.id === end.point);
    return p ? [p.x * TRAY_WIDTH, 0.03, p.z * TRAY_DEPTH] : null;
  }
  const slot = layout.slots.find((s) => s.component === end.component && s.index === end.index);
  if (!slot) return null;
  const box = slotBox(slot, heightRU);
  return [box.position[0], box.position[1] + box.size[1] / 2 + 0.005, box.position[2]];
}

/**
 * The connections layer: one curve per link, coloured by kind. Links of the
 * selected part are drawn bright and thick; the rest fade while something
 * inside the tray is selected.
 */
function TrayLinks({ trayKey, layout }: { trayKey: string; layout: TrayLayout }) {
  const trayId = trayKey.split('.')[0]!;
  const selected = useExplorer((s) => s.selected);
  const network = useExplorer((s) => s.network);
  const invalidate = useThree((s) => s.invalidate);
  const within = selected.startsWith(`${trayKey}/`) ? selected.slice(trayKey.length + 1) : null;
  const active = useMemo(() => new Set(within ? model.linksAt(trayId, within) : []), [trayId, within]);
  useEffect(() => invalidate(), [active, invalidate]);
  return (
    <group>
      {(layout.links ?? []).map((link, i) => {
        const a = endPosition(layout, link.from);
        const b = endPosition(layout, link.to);
        if (!a || !b) return null;
        const lift = 0.06 + Math.hypot(a[0] - b[0], a[2] - b[2]) * 0.12;
        const mid: Vec = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + lift, (a[2] + b[2]) / 2];
        const on = active.has(link);
        const dim = (within !== null && !on) || network !== '';
        return (
          <QuadraticBezierLine
            key={i}
            start={a}
            end={b}
            mid={mid}
            color={LINK_COLORS[link.kind] ?? '#ffffff'}
            lineWidth={on ? 4 : 2}
            dashed={link.assumed === true}
            dashSize={0.03}
            gapSize={0.02}
            transparent
            opacity={dim ? 0.2 : 0.95}
            raycast={() => null}
          />
        );
      })}
    </group>
  );
}

/** Name shown for a part instance: NVIDIA's label when the layout has one. */
export function partLabel(item: Placed, i18n: I18n = i18nFor('en')): string {
  if (item.slot.label) return item.slot.label;
  return i18n.segmentLabel({ id: item.slot.component, index: item.slot.index });
}

function Labels({ placed, heightRU }: { placed: Placed[]; heightRU: number }) {
  const connected = useThree((s) => s.events.connected);
  const hovered = useExplorer((s) => s.hovered);
  const i18n = useI18n();
  if (!connected) return null;
  const hoveredItem = placed.find((p) => p.path === hovered);
  const box = hoveredItem ? slotBox(hoveredItem.slot, heightRU) : null;
  return (
    <>
      <Html position={[0, 0.02, TRAY_DEPTH / 2 + 0.12]} center className="tray-label" style={{ pointerEvents: 'none' }}>
        <span>{i18n.t('scene.front')}</span>
      </Html>
      <Html position={[0, 0.02, -TRAY_DEPTH / 2 - 0.12]} center className="tray-label" style={{ pointerEvents: 'none' }}>
        <span>{i18n.t('scene.rear')}</span>
      </Html>
      {hoveredItem && box && (
        <Html
          position={[box.position[0], box.position[1] + box.size[1] / 2 + 0.04, box.position[2]]}
          center
          className="part-tooltip"
          style={{ pointerEvents: 'none' }}
        >
          <span>{partLabel(hoveredItem, i18n)}</span>
        </Html>
      )}
    </>
  );
}

/**
 * The open interior of a tray or shelf (compute tray, switch tray, power
 * shelf), generated from its tray layout in the data file.
 */
export function TrayScene({ trayKey }: { trayKey: string }) {
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
  const layers = useExplorer((s) => s.layers);
  const heightRU = layout?.heightRU ?? 1;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [layers, invalidate]);
  if (!layout) return null;
  return (
    <group>
      <group visible={layers.structure}>
        <TrayShell heightRU={heightRU} frontColor={TYPE_COLORS[model.getComponent(trayId)?.type ?? 'rack'] ?? '#8b7d5c'} />
      </group>
      {/* Unmounted rather than hidden: three.js still hit-tests invisible meshes. */}
      {layers.parts &&
        groups.map(([component, items]) => (
          <PartInstances key={component} trayKey={trayKey} items={items} heightRU={heightRU} />
        ))}
      {layers.parts && <Indicators layout={layout} />}
      {layers.links && <TrayLinks trayKey={trayKey} layout={layout} />}
      <Labels placed={placed} heightRU={heightRU} />
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color={SCENE_COLORS.floor} />
      </mesh>
    </group>
  );
}
