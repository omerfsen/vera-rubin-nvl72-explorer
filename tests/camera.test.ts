import { describe, expect, it } from 'vitest';
import en from '../data/i18n/en.json';
import tr from '../data/i18n/tr.json';
import zh from '../data/i18n/zh.json';
import ru from '../data/i18n/ru.json';
import es from '../data/i18n/es.json';
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

  it('straight looks from +z, opposite from -z, above from the top, angled from the right corner', () => {
    const t = base.target;
    const straight = presetPose(base, 'straight').position;
    const opposite = presetPose(base, 'opposite').position;
    const above = presetPose(base, 'above').position;
    const angled = presetPose(base, 'angled').position;
    expect(straight[2]).toBeGreaterThan(t[2]);
    expect(straight[0]).toBeCloseTo(t[0], 6);
    expect(opposite[2]).toBeLessThan(t[2]);
    expect(opposite[0]).toBeCloseTo(t[0], 6);
    expect(polar(above, t)).toBeCloseTo(TOP_POLAR, 6);
    expect(above[1] - t[1]).toBeGreaterThan(dist(above, t) * 0.9);
    expect(angled[0] - t[0]).toBeCloseTo(angled[2] - t[2], 6);
    expect(angled[0]).toBeGreaterThan(t[0]);
    expect(angled[1]).toBeGreaterThan(straight[1]);
  });

  it('follows the side the view looks from, so straight on in the rear view shows the rear', () => {
    const rear: Pose = { position: [-2, 0.5, -4], target: [0, 0.2, -0.2] };
    const t = rear.target;
    const straight = presetPose(rear, 'straight').position;
    const opposite = presetPose(rear, 'opposite').position;
    const angled = presetPose(rear, 'angled').position;
    expect(straight[2]).toBeLessThan(t[2]);
    expect(straight[0]).toBeCloseTo(t[0], 6);
    expect(opposite[2]).toBeGreaterThan(t[2]);
    expect(angled[2]).toBeLessThan(t[2]);
    expect(angled[0]).toBeLessThan(t[0]);
    expect(angled[0] - t[0]).toBeCloseTo(angled[2] - t[2], 6);
  });

  it('every preset has its button text and accessible name in every language, and the name contains the text', () => {
    for (const [lang, file] of Object.entries({ en, tr, zh, ru, es })) {
      const strings = file.ui.cameraView as Record<string, string>;
      for (const p of CAMERA_PRESETS) {
        const text = strings[p];
        const label = strings[`${p}Label`];
        expect(text, `${lang} cameraView.${p}`).toBeTruthy();
        expect(label, `${lang} cameraView.${p}Label`).toBeTruthy();
        expect(label!.toLocaleLowerCase(lang), `${lang} cameraView.${p}Label`).toContain(text!.toLocaleLowerCase(lang));
      }
    }
  });

  it('never goes past the orbit limit', () => {
    const pose = presetPose(base, 'straight', 0.3);
    expect(polar(pose.position, pose.target)).toBeLessThanOrEqual(0.3 + 1e-9);
  });

  it('orbits round the target instead of cutting through it', () => {
    const from = presetPose(base, 'straight');
    const to = presetPose(base, 'opposite');
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
