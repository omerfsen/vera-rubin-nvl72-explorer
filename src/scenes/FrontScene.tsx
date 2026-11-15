import { useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D } from 'three';
import { model } from '../data';
import type { TraySlot } from '../data/types';
import { useExplorer } from '../state/store';
import { partColor } from './colors';
import { LED_COLORS, NETWORK_COLORS, SLIDE_OUT, UNIT_DEPTH, UNIT_WIDTH, unitBoxes } from './geometry';
import { Rods, type Segment, type Vec } from './Rods';

const boxes = unitBoxes(model.rackUnits, model.totalRU);
const boxByKey = new Map(boxes.map((b) => [b.key, b]));
const FRONT = UNIT_DEPTH / 2;
const scratch = new Object3D();

export interface FacePlate {
  unitKey: string;
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
      out.push({
        unitKey: unit.key,
        component: slot.component,
        color: partColor(slot.component),
        position: [r.x, r.y, FRONT + 0.003 + slide],
        size: [r.w * 0.92, r.h * 0.85, 0.005],
      });
      (slot.indicators ?? []).forEach((led, k) => {
        const s = Math.min(0.006, r.h * 0.25);
        out.push({
          unitKey: unit.key,
          component: `${slot.component}:led`,
          color: LED_COLORS[led.color] ?? '#ffffff',
          position: [r.x - (r.w * 0.92) / 2 + s * (1.2 + k * 1.8), r.y + (r.h * 0.85) / 2 - s * 1.2, FRONT + 0.007 + slide],
          size: [s, s, 0.003],
        });
      });
    }
  }
  return out;
}

function FacePlates() {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const selected = useExplorer((s) => s.selected);
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
      mesh.setColorAt(i, color.set(p.color));
    });
    mesh.count = plates.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [plates, invalidate]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, plates.length]} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.6} />
    </instancedMesh>
  );
}

/**
 * The management cabling of section 1.5: from every BMC port in the rack to
 * the top-of-rack switch pair. Ports come from each unit's layout; the
 * routing and the split across the two switches are not stated, so the
 * lines end on the pair as a whole.
 */
export function managementLinks(): Segment[] {
  const tors = model.rackUnits.filter((u) => u.componentId === 'tor-switch').map((u) => boxByKey.get(u.key)!);
  if (tors.length === 0) return [];
  const torY = tors.reduce((sum, b) => sum + b.position[1], 0) / tors.length;
  const starts: Vec[] = [];
  for (const c of model.topology.connections) {
    if (c.to !== 'tor-switch') continue;
    const unitType = [...model.ancestorsOf(c.from), c.from].find((id) => model.isRackUnitType(id));
    const layout = unitType ? model.trayLayout(unitType) : undefined;
    if (!unitType || !layout) continue;
    // The BMC's own front port: a front slot for a port inside the BMC (or the BMC itself).
    const slot = layout.slots.find(
      (s) =>
        s.face === 'front' &&
        model.getComponent(s.component)?.type === 'port' &&
        (s.component === c.from || model.ancestorsOf(s.component).includes(c.from)),
    );
    if (!slot) continue;
    for (const unit of model.rackUnits.filter((u) => u.componentId === unitType)) {
      const r = faceRect(slot, unit.key);
      if (r) starts.push([r.x, r.y, FRONT + 0.01]);
    }
  }
  return starts.map((from, i) => ({
    from,
    to: [-UNIT_WIDTH / 2 + ((i + 0.5) / starts.length) * UNIT_WIDTH, torY, FRONT + 0.03],
  }));
}

/** Front-face detail, plus the management cabling while a ToR switch is selected or ipminet is highlighted. */
export function FrontScene() {
  const layers = useExplorer((s) => s.layers);
  const selected = useExplorer((s) => s.selected);
  const network = useExplorer((s) => s.network);
  const links = useMemo(managementLinks, []);
  const torSelected = (selected.split('/')[0] ?? '').startsWith('tor-switch.');
  const showLinks = layers.links && (torSelected || network === 'ipminet');
  return (
    <group>
      {layers.parts && <FacePlates />}
      {showLinks && <Rods list={links} color={NETWORK_COLORS.ipminet ?? '#4dd0e1'} opacity={0.75} thickness={0.004} />}
    </group>
  );
}
