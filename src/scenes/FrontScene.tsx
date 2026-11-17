import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D } from 'three';
import { model } from '../data';
import type { TraySlot } from '../data/types';
import { useExplorer } from '../state/store';
import { partColor } from './colors';
import { ledColor, NETWORK_COLORS, PART_HOVER_COLOR, PART_SELECTED_COLOR, SLIDE_OUT, UNIT_DEPTH, UNIT_WIDTH, unitBoxes } from './geometry';
import { Rods, type Segment, type Vec } from './Rods';
import { FlowRods } from './FlowRods';
import { isFlowMember, stubFrom } from './flow';
import { faceClickAction, facePartPath } from './faceHover';

/** Pointer travel (px) above which a click counts as a drag. */
const DRAG_THRESHOLD = 6;

const boxes = unitBoxes(model.rackUnits, model.totalRU);
const boxByKey = new Map(boxes.map((b) => [b.key, b]));
const FRONT = UNIT_DEPTH / 2;
const scratch = new Object3D();
const noRaycast = () => null;

export interface FacePlate {
  unitKey: string;
  /** Path of the part the plate shows (a status LED shares its part's path). */
  path: string;
  /** A status LED, not the part's own face. */
  led: boolean;
  component: string;
  color: string;
  position: Vec;
  size: Vec;
}

/** Where a slot shows on a unit's front face, in the unit's own frame (no slide). */
function faceRect(slot: TraySlot, unitKey: string): { x: number; y: number; w: number; h: number } | null {
  const box = boxByKey.get(unitKey);
  if (!box) return null;
  const height = box.size[1];
  const bottom = box.position[1] - height / 2;
  if (slot.face === 'front') {
    return { x: slot.x * UNIT_WIDTH, y: bottom + (slot.y ?? 0.5) * height, w: slot.w * UNIT_WIDTH, h: slot.h * height };
  }
  if (slot.y !== undefined) {
    // A stacked part (a PSU row) shows its front face.
    return { x: slot.x * UNIT_WIDTH, y: bottom + (slot.y + slot.h / 2) * height, w: slot.w * UNIT_WIDTH, h: slot.h * height };
  }
  return null;
}

/**
 * Front-face detail for every unit in the rack, generated from each unit
 * type's layout: ports, drives and cages, PSU faces, and status LEDs.
 */
export function facePlates(selectedKey: string | null): FacePlate[] {
  const out: FacePlate[] = [];
  for (const unit of model.rackUnits) {
    const layout = model.trayLayout(unit.componentId);
    if (!layout) continue;
    const slide = unit.key === selectedKey ? SLIDE_OUT : 0;
    for (const slot of layout.slots) {
      const r = faceRect(slot, unit.key);
      if (!r) continue;
      const path = facePartPath(unit.key, unit.componentId, slot);
      out.push({
        unitKey: unit.key,
        path,
        led: false,
        component: slot.component,
        color: partColor(slot.component),
        position: [r.x, r.y, FRONT + 0.003 + slide],
        size: [r.w * 0.92, r.h * 0.85, 0.005],
      });
      (slot.indicators ?? []).forEach((led, k) => {
        const s = Math.min(0.006, r.h * 0.25);
        out.push({
          unitKey: unit.key,
          path,
          led: true,
          component: `${slot.component}:led`,
          color: ledColor(led),
          position: [r.x - (r.w * 0.92) / 2 + s * (1.2 + k * 1.8), r.y + (r.h * 0.85) / 2 - s * 1.2, FRONT + 0.007 + slide],
          size: [s, s, 0.003],
        });
      });
    }
  }
  return out;
}

/** The face plate (not an LED) of every front part, by path, with the unit in its rack place. */
const plateByPath = new Map(facePlates(null).filter((p) => !p.led).map((p) => [p.path, p]));

/** Whether a path is a part drawn on a rack unit's front face. */
export function isFacePart(path: string | null): boolean {
  return path !== null && plateByPath.has(path);
}

/**
 * Colour of a front-face plate. A hovered or selected part takes a darker
 * highlight than its unit, which is lit at the same time, so the part stands
 * out on the face instead of blending into it.
 */
export function facePlateColor(plate: FacePlate, selected: string, hovered: string | null): string {
  if (plate.led) return plate.color;
  if (plate.path === selected) return PART_SELECTED_COLOR;
  if (plate.path === hovered) return PART_HOVER_COLOR;
  return plate.color;
}

/** The rack unit a hover lights: the unit itself, or the unit holding a hovered front part. */
export function hoveredUnitKey(hovered: string | null): string | null {
  return isFacePart(hovered) ? (hovered!.split('/')[0] ?? null) : hovered;
}

/** Where to hang a front part's name tag: above its plate, on the front face, slid out with its unit. */
export function facePartTagPosition(path: string, selectedKey: string | null): Vec | null {
  const p = plateByPath.get(path);
  if (!p) return null;
  const slide = p.unitKey === selectedKey ? SLIDE_OUT : 0;
  return [p.position[0], p.position[1] + p.size[1] / 2 + 0.02, p.position[2] + slide];
}

function FacePlates() {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const selected = useExplorer((s) => s.selected);
  const hovered = useExplorer((s) => s.hovered);
  const rear = useExplorer((s) => s.view === 'rear');
  const select = useExplorer((s) => s.select);
  const setHovered = useExplorer((s) => s.setHovered);
  const openTray = useExplorer((s) => s.openTray);
  const first = selected.split('/')[0] ?? '';
  const selectedKey = model.rackUnitByKey.has(first) ? first : null;
  const plates = useMemo(() => facePlates(selectedKey), [selectedKey]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const color = new Color();
    plates.forEach((p, i) => {
      scratch.position.set(...p.position);
      scratch.scale.set(...p.size);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
      mesh.setColorAt(i, color.set(facePlateColor(p, selected, hovered)));
    });
    mesh.count = plates.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // The selected unit's plates slide out; a stale bounding sphere would miss them.
    mesh.computeBoundingSphere();
    invalidate();
  }, [plates, invalidate, selected, hovered]);

  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
  );

  const pathOf = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId === undefined ? null : (plates[e.instanceId]?.path ?? null);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, plates.length]}
      // From the rear the parts there have their own tags; the front faces stay decoration.
      raycast={rear ? noRaycast : InstancedMesh.prototype.raycast}
      onPointerMove={(e) => {
        // Stop first: R3F then sends the unit behind its pointer-out (which clears the hover) before this sets it.
        e.stopPropagation();
        const path = pathOf(e);
        if (path !== useExplorer.getState().hovered) setHovered(path);
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
        if (!path) return;
        if (faceClickAction(path, useExplorer.getState().selected) === 'unit') {
          select(path.split('/')[0]!);
          return;
        }
        select(path);
        openTray();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const path = pathOf(e);
        if (!path) return;
        select(path);
        openTray();
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.6} />
    </instancedMesh>
  );
}

/** A management link, with the port component it starts from. */
export interface ManagementLink extends Segment {
  component: string;
}

/**
 * The management cabling of section 1.5: from every BMC port in the rack to
 * the top-of-rack switch pair. Ports come from each unit's layout; the
 * routing and the split across the two switches are not stated, so the
 * lines end on the pair as a whole.
 */
export function managementLinks(): { stated: ManagementLink[]; assumed: ManagementLink[] } {
  // Connections that end on a rack unit type (in this rack: the ToR switches): from a BMC or DPU
  // (stated), or from a whole unit whose BMC port is this app's reading (assumed).
  const managed = new Set(['bmc', 'dpu']);
  const toUnit = model.topology.connections.filter((c) => c.to !== undefined && model.isRackUnitType(c.to));
  const bmcLinks = toUnit.filter(
    (c) => managed.has(model.getComponent(c.from)?.type ?? '') || (model.isRackUnitType(c.from) && model.trayLayout(c.from)),
  );
  const target = bmcLinks[0]?.to;
  const targets = model.rackUnits.filter((u) => u.componentId === target).map((u) => boxByKey.get(u.key)!);
  if (targets.length === 0) return { stated: [], assumed: [] };
  const torY = targets.reduce((sum, b) => sum + b.position[1], 0) / targets.length;
  const starts: { at: Vec; assumed: boolean; component: string }[] = [];
  for (const c of bmcLinks) {
    const unitType = [...model.ancestorsOf(c.from), c.from].find((id) => model.isRackUnitType(id));
    const layout = unitType ? model.trayLayout(unitType) : undefined;
    if (!unitType || !layout) continue;
    const isPort = (id: string) => model.getComponent(id)?.type === 'port';
    const inside = (id: string, owner: string) => id === owner || model.ancestorsOf(id).includes(owner);
    // The BMC's own front port: a front slot for a port inside the BMC (or the BMC itself);
    // for a whole unit, the front port of a BMC inside it.
    const slot = layout.slots.find(
      (s) =>
        s.face === 'front' &&
        isPort(s.component) &&
        (c.from === unitType
          ? model.ancestorsOf(s.component).some((a) => model.getComponent(a)?.type === 'bmc')
          : inside(s.component, c.from)),
    );
    if (!slot) continue;
    const assumed = c.assumed === true;
    for (const unit of model.rackUnits.filter((u) => u.componentId === unitType)) {
      const r = faceRect(slot, unit.key);
      if (r) starts.push({ at: [r.x, r.y, FRONT + 0.01], assumed, component: slot.component });
    }
  }
  const all = starts.map((s, i) => ({
    assumed: s.assumed,
    seg: { component: s.component, from: s.at, to: [-UNIT_WIDTH / 2 + ((i + 0.5) / starts.length) * UNIT_WIDTH, torY, FRONT + 0.03] as Vec },
  }));
  return { stated: all.filter((a) => !a.assumed).map((a) => a.seg), assumed: all.filter((a) => a.assumed).map((a) => a.seg) };
}

/**
 * The path of a network across the rack front: the management links that
 * start from one of its ports, and a short stub out of every other front port
 * that is a stated member (its cabling outside the rack is not in the guide).
 */
export function networkFlowSegments(network: string, selectedKey: string | null = null): { links: Segment[]; stubs: Segment[] } {
  if (!network) return { links: [], stubs: [] };
  const { stated, assumed } = managementLinks();
  const linked = new Set([...stated, ...assumed].map((l) => l.component));
  const links = stated.filter((l) => isFlowMember(network, l.component));
  const stubs: Segment[] = [];
  for (const unit of model.rackUnits) {
    const slide = unit.key === selectedKey ? SLIDE_OUT : 0;
    for (const slot of model.trayLayout(unit.componentId)?.slots ?? []) {
      if (slot.face !== 'front' || linked.has(slot.component) || !isFlowMember(network, slot.component)) continue;
      const r = faceRect(slot, unit.key);
      if (r) stubs.push(stubFrom([r.x, r.y, FRONT + 0.006 + slide]));
    }
  }
  return { links, stubs };
}

/** The network the management links are on: the first network one of their ports belongs to. */
export function managementNetwork(links: ManagementLink[]): string {
  const ports = new Set(links.map((l) => l.component));
  return model.topology.networks.find((n) => [...ports].some((c) => model.networkMembers(n.id).members.has(c)))?.id ?? '';
}

/**
 * Front-face detail, the management cabling while a ToR switch is selected or
 * its network is shown, and the shown network's flow on top.
 */
export function FrontScene() {
  const layers = useExplorer((s) => s.layers);
  const selected = useExplorer((s) => s.selected);
  const network = useExplorer((s) => s.network);
  const links = useMemo(managementLinks, []);
  const linkNetwork = useMemo(() => managementNetwork(links.stated), [links]);
  const target = model.topology.connections.find((c) => c.to && model.isRackUnitType(c.to) && model.getComponent(c.from)?.type === 'bmc')?.to;
  const first = selected.split('/')[0] ?? '';
  const torSelected = target !== undefined && first.startsWith(`${target}.`);
  const showLinks = layers.links && (torSelected || (network !== '' && network === linkNetwork));
  const linkColor = NETWORK_COLORS[linkNetwork] ?? '#ffffff';
  const selectedKey = model.rackUnitByKey.has(first) ? first : null;
  const flow = useMemo(() => networkFlowSegments(network, selectedKey), [network, selectedKey]);
  const flowList = useMemo(() => [...flow.links, ...flow.stubs], [flow]);
  const flowColor = NETWORK_COLORS[network] ?? '#ffffff';
  return (
    <group>
      {layers.parts && <FacePlates />}
      {showLinks && <Rods list={links.stated} color={linkColor} opacity={0.75} thickness={0.004} />}
      {showLinks && links.assumed.length > 0 && <Rods list={links.assumed} color={linkColor} opacity={0.3} thickness={0.003} />}
      {layers.links && flow.stubs.length > 0 && <Rods list={flow.stubs} color={flowColor} opacity={0.6} thickness={0.004} />}
      {layers.links && <FlowRods list={flowList} color={flowColor} thickness={0.008} />}
    </group>
  );
}
