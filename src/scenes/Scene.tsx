import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Vector3 } from 'three';
import { model } from '../data';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';
import { trayKeyOf } from '../state/url';
import { RackScene, rackCameraDistance } from './RackScene';
import { TrayScene } from './TrayScene';
import { useSceneTheme } from './useSceneTheme';

const FOV = 38;
const RACK_DISTANCE = rackCameraDistance(FOV);

/** Where the camera sits and looks for each view. */
type Vec = [number, number, number];
const CAMERAS: Record<'rack' | 'rear' | 'tray' | 'shelf', { position: Vec; target: Vec; maxDistance: number }> = {
  rack: { position: [RACK_DISTANCE * 0.23, 0.3, RACK_DISTANCE], target: [0, 0, 0], maxDistance: RACK_DISTANCE * 2 },
  rear: { position: [-RACK_DISTANCE * 0.7, 0.45, -RACK_DISTANCE * 0.75], target: [0, 0, -0.2], maxDistance: RACK_DISTANCE * 2 },
  tray: { position: [0, 1.75, 2.2], target: [0, 0, 0.3], maxDistance: 5 },
  // A shelf several units tall (the power shelf) is seen from the front, like NVIDIA's Fig. 8.
  shelf: { position: [0.5, 0.75, 2.6], target: [0, 0.15, 0.2], maxDistance: 5 },
};

/** The parts of drei's OrbitControls this file uses. */
interface Controls {
  target: Vector3;
  maxDistance: number;
  update: () => void;
}

/** Moves the camera when the view changes; free orbiting in between. */
function CameraRig({ view }: { view: 'rack' | 'rear' | 'tray' | 'shelf' }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const c = CAMERAS[view];
    camera.position.set(c.position[0], c.position[1], c.position[2]);
    if (controls) {
      controls.target.set(c.target[0], c.target[1], c.target[2]);
      controls.maxDistance = c.maxDistance;
      controls.update();
    } else {
      camera.lookAt(c.target[0], c.target[1], c.target[2]);
    }
    invalidate();
  }, [view, camera, controls, invalidate]);
  return null;
}

export default function Scene() {
  const view = useExplorer((s) => s.view);
  const selected = useExplorer((s) => s.selected);
  const trayKey = view === 'tray' ? trayKeyOf(selected, model) : null;
  const [contextLost, setContextLost] = useState(false);
  const { t, segmentLabel } = useI18n();
  const layout = trayKey ? model.trayLayout(trayKey.split('.')[0]!) : undefined;
  // Tall shelves (PSU rows) and units that are only a front panel (the ToR switch) are seen from the front.
  const tall = layout ? (layout.heightRU ?? 1) > 1 || layout.slots.every((s) => s.face === 'front') : false;
  const effectiveView = trayKey ? (tall ? 'shelf' : 'tray') : view === 'rear' ? 'rear' : 'rack';
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
        <CameraRig view={effectiveView} />
      </Canvas>
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
