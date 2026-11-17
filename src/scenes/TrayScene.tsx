import { useSceneTheme } from './useSceneTheme';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  BackSide,
  Color,
  DataTexture,
  Group,
  InstancedMesh,
  NearestFilter,
  Object3D,
  QuadraticBezierCurve3,
  RepeatWrapping,
  RGBAFormat,
  TubeGeometry,
  Vector3,
} from 'three';
import { model } from '../data';
import type { LinkEnd, TrayLayout, TraySlot } from '../data/types';
import { useExplorer } from '../state/store';
import { visibleLinks } from '../data/linkFilter';
import { i18nFor, useI18n, type I18n } from '../i18n';
import { isPartSelected, partColor } from './colors';
import { Rods, type Segment } from './Rods';
import { FlowRods } from './FlowRods';
import { isFlowMember, stubFrom } from './flow';
import {
  CONFLICT_COLOR,
  HOVER_COLOR,
  ledColor,
  NETWORK_COLORS,
  SELECTED_COLOR,
  linkShape,
  type LinkShape,
  TYPE_COLORS,
  TRAY_DEPTH,
  TRAY_HEIGHT,
  TRAY_WIDTH,
  slotBox,
} from './geometry';
import { explodeOffsets, prefersReducedMotion, scaleOffset, stepExplode } from './explode';

/** Pointer travel (px) above which a click counts as a drag. */
const DRAG_THRESHOLD = 6;
const scratch = new Object3D();

type Vec = [number, number, number];

interface Placed {
  slot: TraySlot;
  path: string;
  /** Offset of the part when the tray is fully exploded. */
  offset: Vec;
}

/** How far the tray is exploded right now: 0 assembled, 1 exploded; changes every frame while animating. */
type Amount = MutableRefObject<number>;

/** All slots of one component inside the open tray, as one InstancedMesh. */
function PartInstances({ trayKey, items, heightRU, amount }: { trayKey: string; items: Placed[]; heightRU: number; amount: Amount }) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const selected = useExplorer((s) => s.selected);
  const hovered = useExplorer((s) => s.hovered);
  const select = useExplorer((s) => s.select);
  const setHovered = useExplorer((s) => s.setHovered);
  const network = useExplorer((s) => s.network);
  const { dim } = useSceneTheme();
  const base = useMemo(() => new Color(partColor(items[0]!.slot.component)), [items]);
  // With the network overlay on, parts on the network take its colour (or the
  // conflict colour), parts of a unit on the network (the ToR switch's ports)
  // a muted version of it, and everything else is dimmed.
  const overlay = useMemo(() => {
    if (!network) return null;
    const { members, memberOf } = model.networkMembers(network);
    const id = items[0]!.slot.component;
    const owner = memberOf(id);
    const color = NETWORK_COLORS[network] ?? '#ffffff';
    if (!owner) return dim;
    if (owner !== id) return `#${new Color(color).lerp(new Color(dim), 0.5).getHexString()}`;
    return members.get(id)!.alternative ? CONFLICT_COLOR : color;
  }, [network, items, dim]);

  const written = useRef(-1);
  const place = useCallback(
    (a: number) => {
      const mesh = ref.current;
      if (!mesh) return;
      items.forEach((it, i) => {
        const box = slotBox(it.slot, heightRU);
        const lift = isPartSelected(it.path, selected) && it.slot.face === 'top' ? 0.03 : 0;
        const [dx, dy, dz] = scaleOffset(it.offset, a);
        scratch.position.set(box.position[0] + dx, box.position[1] + lift + dy, box.position[2] + dz);
        scratch.scale.set(...box.size);
        scratch.updateMatrix();
        mesh.setMatrixAt(i, scratch.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      written.current = a;
    },
    [items, heightRU, selected],
  );
  // Follow the explode animation; the scene driver keeps frames coming until it settles.
  useFrame(() => {
    if (written.current !== amount.current) place(amount.current);
  });

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    place(amount.current);
    const color = new Color();
    items.forEach((it, i) => {
      if (isPartSelected(it.path, selected)) color.set(SELECTED_COLOR);
      else if (it.path === hovered) color.set(HOVER_COLOR);
      else if (overlay) color.set(overlay);
      else color.copy(base);
      mesh.setColorAt(i, color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [items, selected, hovered, base, invalidate, trayKey, overlay, place, amount]);

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
  const { scene } = useSceneTheme();
  const TRAY_HEIGHT_RU = TRAY_HEIGHT * heightRU;
  const frontHeight = heightRU > 1 ? TRAY_HEIGHT * 0.12 : TRAY_HEIGHT_RU;
  const parts: { position: [number, number, number]; size: [number, number, number]; color: string }[] = [
    { position: [0, 0, 0], size: [TRAY_WIDTH, 0.01, TRAY_DEPTH], color: scene.trayBase },
    { position: [-TRAY_WIDTH / 2, TRAY_HEIGHT_RU / 2, 0], size: [wall, TRAY_HEIGHT_RU, TRAY_DEPTH], color: scene.trayWall },
    { position: [TRAY_WIDTH / 2, TRAY_HEIGHT_RU / 2, 0], size: [wall, TRAY_HEIGHT_RU, TRAY_DEPTH], color: scene.trayWall },
    { position: [0, TRAY_HEIGHT_RU / 2, -TRAY_DEPTH / 2], size: [TRAY_WIDTH, TRAY_HEIGHT_RU, wall], color: scene.trayWall },
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

/** Status LEDs on the front face of parts that have them (PSUs, the management module). */
function Indicators({ layout, offsets, amount }: { layout: TrayLayout; offsets: Vec[]; amount: Amount }) {
  const heightRU = layout.heightRU ?? 1;
  const ref = useRef<Group>(null);
  const written = useRef(-1);
  useFrame(() => {
    const group = ref.current;
    if (!group || written.current === amount.current) return;
    for (const child of group.children) {
      const [dx, dy, dz] = scaleOffset(child.userData.offset as Vec, amount.current);
      const base = child.userData.base as Vec;
      child.position.set(base[0] + dx, base[1] + dy, base[2] + dz);
    }
    written.current = amount.current;
  });
  const leds = layout.slots.flatMap((slot, i) =>
    (slot.indicators ?? []).map((led, k) => {
      const box = slotBox(slot, heightRU);
      const s = Math.min(0.02, box.size[1] * 0.18);
      const position: Vec = [
        box.position[0] - box.size[0] / 2 + s * (1.4 + k * 2),
        box.position[1] + box.size[1] / 2 - s * 1.4,
        box.position[2] + box.size[2] / 2 + 0.003,
      ];
      return { key: `${slot.component}.${slot.index ?? 0}.${k}`, position, offset: offsets[i]!, s, color: ledColor(led) };
    }),
  );
  return (
    <group ref={ref}>
      {leds.map((l) => (
        <mesh
          key={l.key}
          position={l.position.map((v, j) => v + l.offset[j]! * amount.current) as Vec}
          userData={{ base: l.position, offset: l.offset }}
          raycast={() => null}
        >
          <boxGeometry args={[l.s, l.s, 0.004]} />
          <meshBasicMaterial color={l.color} />
        </mesh>
      ))}
    </group>
  );
}

/** Where a link attaches: the top centre of a part, or a named point on the tray floor. */
function endPosition(layout: TrayLayout, end: LinkEnd, offsets: Vec[], amount: number): Vec | null {
  const heightRU = layout.heightRU ?? 1;
  if (end.point !== undefined) {
    const p = layout.points?.find((pt) => pt.id === end.point);
    return p ? [p.x * TRAY_WIDTH, 0.03, p.z * TRAY_DEPTH] : null;
  }
  const i = layout.slots.findIndex((s) => s.component === end.component && s.index === end.index);
  if (i === -1) return null;
  const box = slotBox(layout.slots[i]!, heightRU);
  const [dx, dy, dz] = scaleOffset(offsets[i], amount);
  return [box.position[0] + dx, box.position[1] + box.size[1] / 2 + 0.005 + dy, box.position[2] + dz];
}

/** Stripes along an assumed link's tube: an alpha map of two lit and two dark texels, repeated along its length. */
const STRIPES = (() => {
  const t = new DataTexture(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 40, 40, 40, 255, 40, 40, 40, 255]), 4, 1, RGBAFormat);
  t.wrapS = RepeatWrapping;
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
})();
/** Length of one stripe period along an assumed tube. */
const STRIPE_PERIOD = 0.05;

/** The curve a link follows: up from both ends and over, higher for longer links. */
export function linkCurve(a: Vec, b: Vec): QuadraticBezierCurve3 {
  const lift = 0.06 + Math.hypot(a[0] - b[0], a[2] - b[2]) * 0.12;
  const mid = new Vector3((a[0] + b[0]) / 2, Math.max(a[1], b[1]) + lift, (a[2] + b[2]) / 2);
  return new QuadraticBezierCurve3(new Vector3(...a), mid, new Vector3(...b));
}

/** Name of one end of a link: the part's label, or the named point on the tray. */
export function linkEndLabel(layout: TrayLayout, trayId: string, end: LinkEnd, i18n: I18n): string {
  if (end.point !== undefined) {
    const p = layout.points?.find((pt) => pt.id === end.point);
    return i18n.pointLabel(trayId, end.point, p?.label ?? end.point);
  }
  const slot = layout.slots.find((s) => s.component === end.component && s.index === end.index);
  if (slot?.label) return slot.label;
  return i18n.segmentLabel({ id: end.component, index: end.index });
}

/** Tube radius for a link: coolant pipes are thicker than signal links. */
export function linkRadius(shape: LinkShape, base: number): number {
  return shape === 'pipe' ? base * 1.6 : base;
}

/** Extra radius of the outline drawn behind every tube. */
const HALO = 0.002;

function LinkTube({
  curve,
  color,
  halo,
  haloOpacity,
  shape,
  assumed,
  radius,
  opacity,
  glow,
  onOver,
  onOut,
  onClick,
}: {
  curve: QuadraticBezierCurve3;
  color: string;
  halo: string;
  haloOpacity: number;
  shape: LinkShape;
  assumed: boolean;
  radius: number;
  opacity: number;
  glow: boolean;
  onOver: (e: ThreeEvent<PointerEvent>) => void;
  onOut: () => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  // Power is a square ribbon, so the shape says what a link carries even without its colour.
  const sides = shape === 'ribbon' ? 4 : 8;
  const r = linkRadius(shape, radius);
  const geometry = useMemo(() => new TubeGeometry(curve, 48, r, sides, false), [curve, r, sides]);
  const outline = useMemo(() => new TubeGeometry(curve, 48, r + HALO, sides, false), [curve, r, sides]);
  const stripes = useMemo(() => {
    if (!assumed) return null;
    const t = STRIPES.clone();
    t.repeat.set(Math.max(1, curve.getLength() / STRIPE_PERIOD), 1);
    t.needsUpdate = true;
    return t;
  }, [assumed, curve]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => outline.dispose(), [outline]);
  useEffect(() => () => stripes?.dispose(), [stripes]);
  const pipe = shape === 'pipe';
  // Hover only brightens the link's own colour; it never takes the hover or selection colour.
  const emissive = pipe ? (glow ? 0.35 : 0) : glow ? 0.9 : 0.25;
  return (
    <group>
      <mesh geometry={outline} raycast={() => null}>
        <meshBasicMaterial color={halo} side={BackSide} transparent opacity={haloOpacity * opacity} depthWrite={false} />
      </mesh>
      <mesh geometry={geometry} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissive}
          roughness={pipe ? 0.8 : 0.4}
          metalness={pipe ? 0 : 0.1}
          transparent
          opacity={assumed ? opacity * 0.75 : opacity}
          alphaMap={stripes}
          depthWrite={!assumed && opacity > 0.5}
        />
      </mesh>
    </group>
  );
}

/**
 * The connections layer: one tube per link, coloured by kind; an assumed
 * link is striped and see-through. Links of the selected part are drawn
 * thicker; the rest fade while something inside the tray is selected.
 * Hovering a tube shows what it is, its two ends and where NVIDIA states it.
 */
function TrayLinks({ trayKey, layout, offsets, amount }: { trayKey: string; layout: TrayLayout; offsets: Vec[]; amount: number }) {
  const trayId = trayKey.split('.')[0]!;
  const selected = useExplorer((s) => s.selected);
  const network = useExplorer((s) => s.network);
  const hiddenKinds = useExplorer((s) => s.hiddenLinkKinds);
  const invalidate = useThree((s) => s.invalidate);
  const connected = useThree((s) => s.events.connected);
  const i18n = useI18n();
  const { links: colors, halo, theme } = useSceneTheme();
  const [hover, setHover] = useState<number | null>(null);
  const within = selected.startsWith(`${trayKey}/`) ? selected.slice(trayKey.length + 1) : null;
  const active = useMemo(() => new Set(within ? model.linksAt(trayId, within) : []), [trayId, within]);
  const links = layout.links ?? [];
  const curves = useMemo(
    () =>
      links.map((link) => {
        const a = endPosition(layout, link.from, offsets, amount);
        const b = endPosition(layout, link.to, offsets, amount);
        return a && b ? linkCurve(a, b) : null;
      }),
    [links, layout, offsets, amount],
  );
  const visible = useMemo(() => visibleLinks(links, hiddenKinds), [links, hiddenKinds]);
  useEffect(() => invalidate(), [active, hover, visible, invalidate]);
  useEffect(() => setHover(null), [trayKey, hiddenKinds]);
  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
  );
  const shown = hover !== null ? links[hover] : undefined;
  const shownCurve = hover !== null ? curves[hover] : null;
  return (
    <group>
      {visible.map(({ link, index: i }) => {
        const curve = curves[i];
        if (!curve) return null;
        const on = active.has(link);
        const dim = hover !== null ? hover !== i : (within !== null && !on) || network !== '';
        return (
          <LinkTube
            key={i}
            curve={curve}
            color={colors[link.kind] ?? '#ffffff'}
            halo={halo}
            haloOpacity={theme === 'dark' ? 0.4 : 0.85}
            shape={linkShape(link.kind)}
            assumed={link.assumed === true}
            radius={on || hover === i ? 0.009 : 0.0055}
            opacity={dim ? 0.15 : 0.95}
            glow={hover === i}
            onOver={(e) => {
              e.stopPropagation();
              setHover(i);
              document.body.style.cursor = 'help';
            }}
            onOut={() => {
              setHover((h) => (h === i ? null : h));
              document.body.style.cursor = '';
            }}
          />
        );
      })}
      {connected && shown && shownCurve && (
        <Html position={shownCurve.getPoint(0.5).toArray()} center className="link-card" style={{ pointerEvents: 'none' }} zIndexRange={[36, 31]}>
          <div data-label data-label-pinned role="tooltip">
            <strong>
              <span className="link-swatch" style={{ background: colors[shown.kind] ?? '#ffffff' }} aria-hidden="true" />
              {i18n.linkName(shown.kind)}
              {shown.assumed && <span className="assumed">{i18n.t('panel.assumed')}</span>}
            </strong>
            <span>
              {linkEndLabel(layout, trayId, shown.from, i18n)} → {linkEndLabel(layout, trayId, shown.to, i18n)}
            </span>
            {shown.note && <span className="link-note">{i18n.linkNote(trayId, hover!, shown.note)}</span>}
            <span className="link-source">
              {i18n.t('panel.sourceLabel')} {shown.source.section}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * The shown network's path inside an open tray: a stub out of every front
 * port that is a stated member. Where the cable goes from there is not in the
 * guide, so the flow only leaves the port.
 */
export function trayFlowSegments(layout: TrayLayout, network: string): Segment[] {
  const heightRU = layout.heightRU ?? 1;
  return layout.slots
    .filter((slot) => slot.face === 'front' && isFlowMember(network, slot.component))
    .map((slot) => {
      const box = slotBox(slot, heightRU);
      return stubFrom([box.position[0], box.position[1], box.position[2] + box.size[2] / 2], 0.15);
    });
}

/** Static stubs for the shown network's ports, with the moving flow on top. */
function TrayFlow({ layout }: { layout: TrayLayout }) {
  const network = useExplorer((s) => s.network);
  const list = useMemo(() => trayFlowSegments(layout, network), [layout, network]);
  if (list.length === 0) return null;
  const color = NETWORK_COLORS[network] ?? '#ffffff';
  return (
    <group>
      <Rods list={list} color={color} opacity={0.6} thickness={0.006} />
      <FlowRods list={list} color={color} thickness={0.012} />
    </group>
  );
}

/** Name shown for a part instance: NVIDIA's label when the layout has one. */
export function partLabel(item: Placed, i18n: I18n = i18nFor('en')): string {
  if (item.slot.label) return item.slot.label;
  return i18n.segmentLabel({ id: item.slot.component, index: item.slot.index });
}

function Labels({ placed, heightRU, amount }: { placed: Placed[]; heightRU: number; amount: number }) {
  const connected = useThree((s) => s.events.connected);
  const hovered = useExplorer((s) => s.hovered);
  const i18n = useI18n();
  if (!connected) return null;
  const hoveredItem = placed.find((p) => p.path === hovered);
  const box = hoveredItem ? slotBox(hoveredItem.slot, heightRU) : null;
  const [dx, dy, dz] = scaleOffset(hoveredItem?.offset, amount);
  return (
    <>
      <Html position={[0, 0.02, TRAY_DEPTH / 2 + 0.12]} center className="tray-label" style={{ pointerEvents: 'none' }}>
        <span data-label>{i18n.t('scene.front')}</span>
      </Html>
      <Html position={[0, 0.02, -TRAY_DEPTH / 2 - 0.12]} center className="tray-label" style={{ pointerEvents: 'none' }}>
        <span data-label>{i18n.t('scene.rear')}</span>
      </Html>
      {hoveredItem && box && (
        <Html
          position={[box.position[0] + dx, box.position[1] + box.size[1] / 2 + 0.04 + dy, box.position[2] + dz]}
          center
          className="part-tooltip"
          style={{ pointerEvents: 'none' }}
          zIndexRange={[20, 10]}
        >
          <span data-label data-label-pinned>
            {partLabel(hoveredItem, i18n)}
          </span>
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
  // Exploded view: layers come from the part types (and rows) in the layout.
  const offsets = useMemo(
    () => (layout ? explodeOffsets(layout, (id) => model.getComponent(id)?.type ?? id) : []),
    [layout],
  );
  const groups = useMemo(() => {
    const byComponent = new Map<string, Placed[]>();
    (layout?.slots ?? []).forEach((slot, i) => {
      const list = byComponent.get(slot.component) ?? [];
      list.push({ slot, path: `${trayKey}/${model.slotPathWithin(trayId, slot)}`, offset: offsets[i]! });
      byComponent.set(slot.component, list);
    });
    return [...byComponent.entries()];
  }, [layout, trayKey, trayId, offsets]);
  const placed = useMemo(() => groups.flatMap(([, items]) => items), [groups]);
  const layers = useExplorer((s) => s.layers);
  const floor = useSceneTheme().scene.floor;
  const heightRU = layout?.heightRU ?? 1;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [layers, invalidate]);
  const exploded = useExplorer((s) => s.exploded);
  const target = exploded ? 1 : 0;
  const amount = useRef(target);
  // The amount links and labels are drawn at; links hide while parts move.
  const [settled, setSettled] = useState(target);
  useEffect(() => invalidate(), [target, invalidate]);
  const animating = useRef(false);
  useFrame((_, delta) => {
    if (amount.current === target) {
      animating.current = false;
      return;
    }
    // The first frame after an idle canvas reports the whole idle time as its
    // delta, so it takes one short step; later frames follow the real clock.
    const dt = animating.current ? Math.min(delta, 0.1) : 1 / 60;
    animating.current = true;
    amount.current = prefersReducedMotion() ? target : stepExplode(amount.current, target, dt);
    invalidate();
    if (amount.current === target) setSettled(target);
  });
  if (!layout) return null;
  return (
    <group>
      <group visible={layers.structure}>
        <TrayShell heightRU={heightRU} frontColor={TYPE_COLORS[model.getComponent(trayId)?.type ?? 'rack'] ?? '#8b7d5c'} />
      </group>
      {/* Unmounted rather than hidden: three.js still hit-tests invisible meshes. */}
      {layers.parts &&
        groups.map(([component, items]) => (
          <PartInstances key={component} trayKey={trayKey} items={items} heightRU={heightRU} amount={amount} />
        ))}
      {layers.parts && <Indicators layout={layout} offsets={offsets} amount={amount} />}
      {layers.links && settled === target && (
        <TrayLinks trayKey={trayKey} layout={layout} offsets={offsets} amount={settled} />
      )}
      {/* The flow stubs sit at the parts' normal places, so they only show when the tray is not exploded. */}
      {layers.links && settled === 0 && target === 0 && <TrayFlow layout={layout} />}
      <Labels placed={placed} heightRU={heightRU} amount={settled} />
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color={floor} />
      </mesh>
    </group>
  );
}
