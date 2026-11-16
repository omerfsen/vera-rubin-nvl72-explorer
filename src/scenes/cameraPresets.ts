/** Camera presets: fixed angles around the current view's framing, and the orbit between two poses. */

export type Vec = [number, number, number];
export interface Pose {
  position: Vec;
  target: Vec;
}

export type CameraPreset = 'reset' | 'straight' | 'opposite' | 'above' | 'angled';
export const CAMERA_PRESETS: readonly CameraPreset[] = ['reset', 'straight', 'opposite', 'above', 'angled'];

/** Spherical offset from the target: radius, polar angle from +y, azimuth from +z towards +x. */
interface Spherical {
  radius: number;
  polar: number;
  azimuth: number;
}

/** Keeps the view from above just off vertical, where orbit controls stay stable. */
export const TOP_POLAR = 0.06 * Math.PI;
const EYE_POLAR = 0.46 * Math.PI;
const ANGLE_POLAR = 0.32 * Math.PI;

function toSpherical(p: Vec, t: Vec): Spherical {
  const x = p[0] - t[0];
  const y = p[1] - t[1];
  const z = p[2] - t[2];
  const radius = Math.hypot(x, y, z);
  if (radius === 0) return { radius: 0, polar: 0, azimuth: 0 };
  return { radius, polar: Math.acos(Math.min(1, Math.max(-1, y / radius))), azimuth: Math.atan2(x, z) };
}

function fromSpherical(s: Spherical, t: Vec): Vec {
  const r = s.radius * Math.sin(s.polar);
  return [t[0] + r * Math.sin(s.azimuth), t[1] + s.radius * Math.cos(s.polar), t[2] + r * Math.cos(s.azimuth)];
}

/**
 * The pose for a preset, built from the view's own framing (`base`): the same
 * target and distance, from another angle. The angles are relative to the side
 * the view itself looks from (the rack's front faces +z, the rear view looks
 * from -z), so they say where the camera goes and never which side is shown:
 * `straight` is level with the side the view shows, `opposite` is the other one.
 */
export function presetPose(base: Pose, preset: CameraPreset, maxPolar = Math.PI): Pose {
  if (preset === 'reset') return { position: [...base.position], target: [...base.target] };
  const { radius } = toSpherical(base.position, base.target);
  const side = base.position[2] < base.target[2] ? Math.PI : 0;
  const angles: Record<Exclude<CameraPreset, 'reset'>, [number, number]> = {
    straight: [EYE_POLAR, 0],
    opposite: [EYE_POLAR, Math.PI],
    above: [TOP_POLAR, 0],
    angled: [ANGLE_POLAR, Math.PI / 4],
  };
  const [polar, turn] = angles[preset];
  const azimuth = side + turn;
  return {
    position: fromSpherical({ radius, polar: Math.min(polar, maxPolar), azimuth }, base.target),
    target: [...base.target],
  };
}

/** Smooth start and stop. */
export function ease(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
}

/**
 * The pose a fraction `t` of the way from `from` to `to`, orbiting around the
 * target (the shorter way round) instead of cutting through the model.
 */
export function interpolatePose(from: Pose, to: Pose, t: number): Pose {
  const k = Math.min(1, Math.max(0, t));
  const lerp = (a: number, b: number) => a + (b - a) * k;
  const target: Vec = [lerp(from.target[0], to.target[0]), lerp(from.target[1], to.target[1]), lerp(from.target[2], to.target[2])];
  const a = toSpherical(from.position, from.target);
  const b = toSpherical(to.position, to.target);
  let turn = b.azimuth - a.azimuth;
  while (turn > Math.PI) turn -= 2 * Math.PI;
  while (turn < -Math.PI) turn += 2 * Math.PI;
  const s: Spherical = { radius: lerp(a.radius, b.radius), polar: lerp(a.polar, b.polar), azimuth: a.azimuth + turn * k };
  return { position: k === 1 ? [...to.position] : fromSpherical(s, target), target: k === 1 ? [...to.target] : target };
}
