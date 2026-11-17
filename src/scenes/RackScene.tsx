import { useSceneTheme } from './useSceneTheme';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Color, InstancedMesh, Matrix4, Object3D } from 'three';
import { model } from '../data';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';
import { RearScene } from './RearScene';
import {
  FRAME_POST,
  FRAME_WIDTH,
  HOVER_COLOR,
  SLIDE_OUT,
  NETWORK_COLORS,
  RU,
  SELECTED_COLOR,
  TYPE_COLORS,
  UNIT_DEPTH,
  UNIT_WIDTH,
  frameHeight,
  unitBoxes,
  type UnitBox,
} from './geometry';

import { FrontScene, facePartTagPosition, isFacePart } from './FrontScene';
import { hoverTagText } from './faceHover';
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
  const openTray = useExplorer((s) => s.openTray);
  const network = useExplorer((s) => s.network);
  const { dim } = useSceneTheme();
  const onNetwork = useMemo(() => (network ? model.networkMembers(network).unitTypes.has(componentId) : null), [network, componentId]);
  const selectedKey = selectedUnitKey(selected);
  // A part on a unit's front face keeps its unit lit.
  const hoveredKey = isFacePart(hovered) ? (hovered!.split('/')[0] ?? null) : hovered;
  // A general selection of this unit type ("power-shelf") lights up every unit of it.
  const typeSelected = selected.split('/')[0] === componentId;
  const type = model.getComponent(componentId)?.type;
  const base = useMemo(() => new Color(TYPE_COLORS[type ?? 'rack'] ?? '#666666'), [type]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const color = new Color();
    units.forEach((u, i) => {
      const box = boxByKey.get(u.key)!;
      placeBox(mesh, i, box, u.key === selectedKey ? SLIDE_OUT : 0);
      if (u.key === selectedKey || typeSelected) color.set(SELECTED_COLOR);
      else if (u.key === hoveredKey) color.set(HOVER_COLOR);
      else if (onNetwork === true) color.set(NETWORK_COLORS[network] ?? '#ffffff');
      else if (onNetwork === false) color.set(dim);
      else color.copy(base);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [units, selectedKey, hoveredKey, base, invalidate, onNetwork, network, typeSelected, dim]);

  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
  );

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
        if (!key) return;
        // A second click on the selected unit opens it, if it has an interior.
        if (useExplorer.getState().selected === key) openTray();
        else select(key);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const key = keyOf(e);
        if (!key) return;
        select(key);
        openTray();
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
  const { scene } = useSceneTheme();
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
      <meshStandardMaterial color={scene.handles} metalness={0.6} roughness={0.35} />
    </instancedMesh>
  );
}

/** Four corner posts plus top and bottom plates. */
function RackFrame() {
  const ref = useRef<InstancedMesh>(null);
  const { scene } = useSceneTheme();
  const height = frameHeight(model.totalRU);
  const halfW = FRAME_WIDTH / 2 - FRAME_POST / 2;
  const halfD = UNIT_DEPTH / 2 + 0.05;
  // Four corner posts plus a top and a bottom plate, as one InstancedMesh.
  const parts = useMemo<{ position: [number, number, number]; size: [number, number, number] }[]>(
    () => [
      ...([
        [-halfW, -halfD],
        [halfW, -halfD],
        [-halfW, halfD],
        [halfW, halfD],
      ] as const).map(([x, z]) => ({
        position: [x, 0, z] as [number, number, number],
        size: [FRAME_POST, height, FRAME_POST] as [number, number, number],
      })),
      ...[height / 2, -height / 2].map((y) => ({
        position: [0, y, 0] as [number, number, number],
        size: [FRAME_WIDTH, 0.03, halfD * 2 + FRAME_POST] as [number, number, number],
      })),
    ],
    [halfW, halfD, height],
  );
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    parts.forEach((p, i) => {
      scratch.position.set(...p.position);
      scratch.scale.set(...p.size);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [parts]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, parts.length]} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={scene.rackFrame} metalness={0.4} roughness={0.7} />
    </instancedMesh>
  );
}

/** "10 x Compute tray" style labels beside each layout group. */
function GroupLabels() {
  const groups = model.topology.rackLayout.groups;
  const i18n = useI18n();
  const selected = useExplorer((s) => s.selected);
  const hovered = useExplorer((s) => s.hovered);
  const groupOf = (path: string | null) => (path ? model.rackUnitByKey.get(path.split('/')[0] ?? '')?.group : undefined);
  const active = new Set([groupOf(selected), groupOf(hovered)]);
  // drei's <Html> picks its DOM target from the connected event source. R3F
  // connects events after the children's first layout effects, so a label
  // mounted earlier would move targets mid-commit and could be lost.
  const connected = useThree((s) => s.events.connected);
  if (!connected) return null;
  return (
    <>
      {groups.map((g, gi) => {
        const units = model.rackUnits.filter((u) => u.group === gi);
        const first = boxByKey.get(units[0]!.key)!;
        const last = boxByKey.get(units[units.length - 1]!.key)!;
        const y = (first.position[1] + last.position[1]) / 2;
        const name = i18n.name(g.component);
        return (
          <Html
            key={gi}
            position={[-FRAME_WIDTH / 2 - 0.04, y, UNIT_DEPTH / 2]}
            center={false}
            className="group-label"
            style={{ pointerEvents: 'none' }}
            zIndexRange={[20, 10]}
          >
            <span data-label data-label-priority={g.count} data-label-pinned={active.has(gi) || undefined}>
              {i18n.t('scene.group', { count: g.count, name })}
            </span>
          </Html>
        );
      })}
    </>
  );
}

/**
 * The name of the rack unit under the pointer, on the face the camera looks
 * at: the group labels only say "18 x Compute tray", not which one. On a
 * port, drive or PSU of its front face, the part's name and its unit's.
 */
function UnitHoverLabel({ rear }: { rear: boolean }) {
  const camera = useThree((s) => s.camera);
  const hovered = useExplorer((s) => s.hovered);
  const selected = useExplorer((s) => s.selected);
  const i18n = useI18n();
  const connected = useThree((s) => s.events.connected);
  if (!connected || !hovered) return null;
  let position: [number, number, number] | null = null;
  if (model.rackUnitByKey.has(hovered)) {
    const box = boxByKey.get(hovered);
    if (!box) return null;
    const slide = hovered === selectedUnitKey(selected) ? SLIDE_OUT : 0;
    // The face the camera is on, so an orbit behind the rack in the front view still tags the near face.
    const z = (camera.position.z < 0 ? -UNIT_DEPTH / 2 : UNIT_DEPTH / 2) + slide;
    position = [box.position[0], box.position[1] + box.size[1] / 2 + 0.03, z];
  } else if (!rear) {
    // From the rear, the rear parts carry their own tags.
    position = facePartTagPosition(hovered, selectedUnitKey(selected));
  }
  const text = position ? hoverTagText(hovered, i18n) : null;
  if (!position || !text) return null;
  return (
    <Html position={position} center className="rear-label unit-hover-label" style={{ pointerEvents: 'none' }} zIndexRange={[20, 10]}>
      <span data-label data-label-pinned>
        {text}
      </span>
    </Html>
  );
}

/**
 * Camera distance from the rack centre at which the whole frame fits the
 * vertical field of view: margin for a slid-out unit, plus half the depth
 * because the front face is closer to the camera than the centre.
 */
export function rackCameraDistance(fovDeg: number): number {
  const height = frameHeight(model.totalRU);
  return ((height / 2) * 1.2) / Math.tan(((fovDeg / 2) * Math.PI) / 180) + UNIT_DEPTH / 2;
}

/** The whole rack: frame, units, handles, rear parts, group labels and floor. */
export function RackScene({ rear }: { rear: boolean }) {
  const height = frameHeight(model.totalRU);
  const layers = useExplorer((s) => s.layers);
  const { scene } = useSceneTheme();
  return (
    <group>
      {layers.structure && <RackFrame />}
      {layers.parts && unitTypes.map((id) => <UnitInstances key={id} componentId={id} />)}
      {layers.parts && <Handles />}
      <RearScene showLabels={rear} />
      <FrontScene />
      {!rear && <GroupLabels />}
      {layers.parts && <UnitHoverLabel rear={rear} />}
      <mesh position={[0, -height / 2 - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color={scene.floor} />
      </mesh>
    </group>
  );
}
