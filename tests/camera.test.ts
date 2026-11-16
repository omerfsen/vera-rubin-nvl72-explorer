import { describe, expect, it } from 'vitest';
import { CAMERA_PRESETS, ease, interpolatePose, presetPose, TOP_POLAR, type Pose, type Vec } from '../src/scenes/cameraPresets';

const base: Pose = { position: [1, 0.5, 4], target: [0, 0.2, 0.3] };
const dist = (p: Vec, t: Vec) => Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]);
const polar = (p: Vec, t: Vec) => Math.acos((p[1] - t[1]) / dist(p, t));

describe('camera presets', () => {
  it('reset returns the view framing', () => {
    expect(presetPose(base, 'reset')).toEqual(base);
  });

  it('every preset keeps the target and the framing distance', () => {
    for (const p of CAMERA_PRESETS) {
      const pose = presetPose(base, p);
      expect(pose.target).toEqual(base.target);
      expect(dist(pose.position, pose.target)).toBeCloseTo(dist(base.position, base.target), 6);
    }
  });

  it('front looks from +z, back from -z, top from above, 45° from the front right', () => {
    const t = base.target;
    const front = presetPose(base, 'front').position;
    const back = presetPose(base, 'back').position;
    const top = presetPose(base, 'top').position;
    const angle = presetPose(base, 'angle').position;
    expect(front[2]).toBeGreaterThan(t[2]);
    expect(front[0]).toBeCloseTo(t[0], 6);
    expect(back[2]).toBeLessThan(t[2]);
    expect(back[0]).toBeCloseTo(t[0], 6);
    expect(polar(top, t)).toBeCloseTo(TOP_POLAR, 6);
    expect(top[1] - t[1]).toBeGreaterThan(dist(top, t) * 0.9);
    expect(angle[0] - t[0]).toBeCloseTo(angle[2] - t[2], 6);
    expect(angle[0]).toBeGreaterThan(t[0]);
    expect(angle[1]).toBeGreaterThan(front[1]);
  });

  it('never goes past the orbit limit', () => {
    const pose = presetPose(base, 'front', 0.3);
    expect(polar(pose.position, pose.target)).toBeLessThanOrEqual(0.3 + 1e-9);
  });

  it('orbits round the target instead of cutting through it', () => {
    const from = presetPose(base, 'front');
    const to = presetPose(base, 'back');
    const start = interpolatePose(from, to, 0);
    start.position.forEach((v, i) => expect(v).toBeCloseTo(from.position[i]!, 9));
    expect(interpolatePose(from, to, 1)).toEqual(to);
    for (const k of [0.25, 0.5, 0.75]) {
      const mid = interpolatePose(from, to, k);
      expect(dist(mid.position, mid.target)).toBeCloseTo(dist(base.position, base.target), 6);
    }
  });

  it('eases from 0 to 1 and clamps', () => {
    expect(ease(-1)).toBe(0);
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBeCloseTo(0.5, 9);
    expect(ease(1)).toBe(1);
    expect(ease(2)).toBe(1);
  });
});
