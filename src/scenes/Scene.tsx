import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Vector3 } from 'three';
import { model } from '../data';
import { useExplorer } from '../state/store';
import { trayKeyOf } from '../state/url';
import { RackScene, rackCameraDistance } from './RackScene';
import { ComputeTrayScene } from './ComputeTrayScene';

const FOV = 38;
const RACK_DISTANCE = rackCameraDistance(FOV);

/** Where the camera sits and looks for each view. */
type Vec = [number, number, number];
const CAMERAS: Record<'rack' | 'tray', { position: Vec; target: Vec; maxDistance: number }> = {
  rack: { position: [RACK_DISTANCE * 0.23, 0.3, RACK_DISTANCE], target: [0, 0, 0], maxDistance: RACK_DISTANCE * 2 },
  tray: { position: [0, 1.75, 2.2], target: [0, 0, 0.3], maxDistance: 5 },
};

/** The parts of drei's OrbitControls this file uses. */
interface Controls {
  target: Vector3;
  maxDistance: number;
  update: () => void;
}

/** Moves the camera when the view changes; free orbiting in between. */
function CameraRig({ view }: { view: 'rack' | 'tray' }) {
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
  const effectiveView = trayKey ? 'tray' : 'rack';
  return (
    <>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [...CAMERAS.rack.position], fov: FOV, near: 0.05, far: 50 }}
        role="img"
        aria-label={
          trayKey
            ? `3D view of ${model.segmentLabel(model.parsePath(trayKey)![0]!)} opened. Use the arrow keys to step through its parts.`
            : '3D view of the rack. Use the list view or the arrow keys to select units.'
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
        <color attach="background" args={['#0e1115']} />
        <hemisphereLight args={['#dfe7f2', '#1a1d22', 0.9]} />
        <directionalLight position={[2.5, 3, 4]} intensity={1.6} />
        <directionalLight position={[-3, 1, -2]} intensity={0.4} />
        {trayKey ? <ComputeTrayScene key={trayKey} trayKey={trayKey} /> : <RackScene />}
        <OrbitControls makeDefault enablePan={false} enableDamping={false} minDistance={0.8} maxPolarAngle={Math.PI * 0.85} />
        <CameraRig view={effectiveView} />
      </Canvas>
      {contextLost && (
        <p className="notice context-lost" role="status">
          The 3D view lost its graphics context. It comes back on its own; the list view still works.
        </p>
      )}
    </>
  );
}
