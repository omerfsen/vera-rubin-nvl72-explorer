import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Vector3 } from 'three';
import { model } from '../data';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';
import { trayKeyOf } from '../state/url';
import { RackScene, rackCameraDistance } from './RackScene';
import { TrayScene } from './TrayScene';
import { useSceneTheme } from './useSceneTheme';
import { CAMERA_PRESETS, ease, interpolatePose, presetPose, type CameraPreset, type Pose, type Vec } from './cameraPresets';
import { LabelDeconflict } from './LabelDeconflict';
import { setCaptureSource } from '../lib/screenshot';

const FOV = 38;
const RACK_DISTANCE = rackCameraDistance(FOV);

/** Where the camera sits and looks for each view. */
const CAMERAS: Record<'rack' | 'rear' | 'tray' | 'shelf', { position: Vec; target: Vec; maxDistance: number }> = {
  rack: { position: [RACK_DISTANCE * 0.23, 0.3, RACK_DISTANCE], target: [0, 0, 0], maxDistance: RACK_DISTANCE * 2 },
  rear: { position: [-RACK_DISTANCE * 0.7, 0.45, -RACK_DISTANCE * 0.75], target: [0, 0, -0.2], maxDistance: RACK_DISTANCE * 2 },
  tray: { position: [0, 1.75, 2.2], target: [0, 0, 0.3], maxDistance: 5 },
  // A shelf several units tall (the power shelf) is seen from the front, like NVIDIA's Fig. 8.
  shelf: { position: [0.5, 0.75, 2.6], target: [0, 0.15, 0.2], maxDistance: 5 },
};
type ViewName = keyof typeof CAMERAS;

/** The parts of drei's OrbitControls this file uses. */
interface Controls {
  target: Vector3;
  maxDistance: number;
  maxPolarAngle: number;
  update: () => void;
  addEventListener: (type: 'start', listener: () => void) => void;
  removeEventListener: (type: 'start', listener: () => void) => void;
}

/** A click on a camera button; `id` changes on every click so the same preset can run twice. */
interface CameraRequest {
  preset: CameraPreset;
  id: number;
}

const MOVE_MS = 700;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Moves the camera when the view changes or a preset is chosen; free orbiting in between. */
function CameraRig({ view, request }: { view: ViewName; request: CameraRequest | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const invalidate = useThree((s) => s.invalidate);
  const move = useRef<{ from: Pose; to: Pose; start: number } | null>(null);

  const apply = useCallback(
    (pose: Pose) => {
      camera.position.set(...pose.position);
      if (controls) {
        controls.target.set(...pose.target);
        controls.update();
      } else {
        camera.lookAt(...pose.target);
      }
      invalidate();
    },
    [camera, controls, invalidate],
  );

  useEffect(() => {
    const c = CAMERAS[view];
    move.current = null;
    if (controls) controls.maxDistance = c.maxDistance;
    apply(c);
  }, [view, controls, apply]);

  // Only a new request starts a move; a view change resets the camera above.
  const latest = useRef({ view, controls, camera, apply, invalidate });
  latest.current = { view, controls, camera, apply, invalidate };
  useEffect(() => {
    if (!request) return;
    const { view: v, controls: ctl, camera: cam, apply: put, invalidate: redraw } = latest.current;
    const to = presetPose(CAMERAS[v], request.preset, ctl?.maxPolarAngle);
    if (prefersReducedMotion()) {
      move.current = null;
      put(to);
      return;
    }
    const t = ctl?.target;
    const from: Pose = {
      position: [cam.position.x, cam.position.y, cam.position.z],
      target: t ? [t.x, t.y, t.z] : to.target,
    };
    move.current = { from, to, start: performance.now() };
    redraw();
  }, [request]);

  // Dragging stops a move in progress.
  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      move.current = null;
    };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);

  useFrame(() => {
    const m = move.current;
    if (!m) return;
    const k = (performance.now() - m.start) / MOVE_MS;
    if (k >= 1) move.current = null;
    // apply() asks for another frame, which keeps the demand loop going until the move ends.
    apply(interpolatePose(m.from, m.to, ease(k)));
  });
  return null;
}

/** Reset and preset angle buttons over the stage. */
function CameraButtons({ onPick }: { onPick: (preset: CameraPreset) => void }) {
  const { t } = useI18n();
  return (
    <div className="camera-presets" role="group" aria-label={t('cameraView.group')}>
      {CAMERA_PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          aria-label={t(`cameraView.${p}Label`)}
          title={t(`cameraView.${p}Label`)}
          onClick={() => onPick(p)}
        >
          {p === 'reset' && <span aria-hidden="true">⟲ </span>}
          {t(`cameraView.${p}`)}
        </button>
      ))}
    </div>
  );
}

export default function Scene() {
  const view = useExplorer((s) => s.view);
  const selected = useExplorer((s) => s.selected);
  const trayKey = view === 'tray' ? trayKeyOf(selected, model) : null;
  const [contextLost, setContextLost] = useState(false);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest | null>(null);
  const { t, segmentLabel } = useI18n();
  const layout = trayKey ? model.trayLayout(trayKey.split('.')[0]!) : undefined;
  // Tall shelves (PSU rows) and units that are only a front panel (the ToR switch) are seen from the front.
  const tall = layout ? (layout.heightRU ?? 1) > 1 || layout.slots.every((s) => s.face === 'front') : false;
  const effectiveView: ViewName = trayKey ? (tall ? 'shelf' : 'tray') : view === 'rear' ? 'rear' : 'rack';
  // A preset belongs to the view it was chosen in.
  useEffect(() => setCameraRequest(null), [effectiveView, trayKey]);
  return (
    <>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [...CAMERAS.rack.position], fov: FOV, near: 0.05, far: 50 }}
        role="img"
        aria-label={
          trayKey
            ? t('scene.trayOpened', { name: segmentLabel(model.parsePath(trayKey)![0]!) })
            : t('scene.rack')
        }
        onPointerMissed={() => useExplorer.getState().setHovered(null)}
        onCreated={({ gl, invalidate }) => {
          // three.js handles context loss itself; with frameloop="demand" nothing
          // redraws after a restore unless we ask for a frame.
          gl.domElement.addEventListener('webglcontextlost', () => setContextLost(true));
          gl.domElement.addEventListener('webglcontextrestored', () => {
            setContextLost(false);
            invalidate();
          });
        }}
      >
        <ThemeColors />
        <directionalLight position={[2.5, 3, 4]} intensity={1.6} />
        <directionalLight position={[-3, 1, -2]} intensity={0.4} />
        {trayKey ? <TrayScene key={trayKey} trayKey={trayKey} /> : <RackScene rear={view === 'rear'} />}
        <OrbitControls makeDefault enablePan={false} enableDamping={false} minDistance={0.8} maxPolarAngle={Math.PI * 0.85} />
        <CameraRig view={effectiveView} request={cameraRequest} />
        <LabelDeconflict />
        <CaptureBridge />
      </Canvas>
      <CameraButtons onPick={(preset) => setCameraRequest((r) => ({ preset, id: (r?.id ?? 0) + 1 }))} />
      {contextLost && (
        <p className="notice context-lost" role="status">
          {t('scene.contextLost')}
        </p>
      )}
    </>
  );
}

/** Background and sky light for the current theme; redraws once when the theme changes. */
function ThemeColors() {
  const { scene } = useSceneTheme();
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [scene, invalidate]);
  return (
    <>
      <color key={`bg-${scene.background}`} attach="background" args={[scene.background]} />
      <hemisphereLight key={`sky-${scene.skyLight}`} args={[scene.skyLight, scene.groundLight, 0.9]} />
    </>
  );
}

/** Lets the Screenshot button render a fresh frame and copy it in the same task. */
function CaptureBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  // drei's <Html> mounts its labels in the element events are connected to.
  const connected = useThree((s) => s.events.connected) as HTMLElement | undefined;
  useEffect(() => {
    const root = connected ?? gl.domElement.parentElement;
    if (!root) return;
    const source = {
      root,
      render: () => {
        gl.render(scene, camera);
        return gl.domElement;
      },
    };
    setCaptureSource(source);
    return () => setCaptureSource(null);
  }, [gl, scene, camera, connected]);
  return null;
}
