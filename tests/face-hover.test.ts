import { describe, expect, it } from 'vitest';
import { model } from '../src/data';
import { i18nFor } from '../src/i18n';
import { facePartTagPosition, facePlates, isFacePart } from '../src/scenes/FrontScene';
import { faceClickAction, hoverTagText } from '../src/scenes/faceHover';

describe('front-face part paths', () => {
  const plates = facePlates(null);

  it('gives every plate a path inside its own unit that the model parses', () => {
    for (const p of plates) {
      expect(p.path.startsWith(`${p.unitKey}/`)).toBe(true);
      expect(model.parsePath(p.path), p.path).not.toBeNull();
    }
  });

  it('gives a status LED the path of the part it sits on', () => {
    const leds = plates.filter((p) => p.led);
    expect(leds.length).toBeGreaterThan(0);
    for (const led of leds) expect(plates.some((p) => !p.led && p.path === led.path)).toBe(true);
  });

  it('keeps the paths when the unit slides out, and moves the tag with it', () => {
    const slid = facePlates('compute-tray.3').filter((p) => p.unitKey === 'compute-tray.3');
    expect(slid.map((p) => p.path)).toEqual(plates.filter((p) => p.unitKey === 'compute-tray.3').map((p) => p.path));
    const path = slid[0]!.path;
    expect(facePartTagPosition(path, 'compute-tray.3')![2]).toBeGreaterThan(facePartTagPosition(path, null)![2]);
  });

  it('knows a front part from a unit key or a rear part', () => {
    expect(isFacePart(plates[0]!.path)).toBe(true);
    expect(isFacePart('compute-tray.3')).toBe(false);
    expect(isFacePart(null)).toBe(false);
  });
});

describe('rack hover tag', () => {
  const en = i18nFor('en');
  const plates = facePlates(null).filter((p) => !p.led);

  it('names a unit on its own', () => {
    expect(hoverTagText('compute-tray.7', en)).toBe('Compute tray 7');
  });

  it("names a front part by NVIDIA's slot label when it has one, with its unit", () => {
    const unit = model.rackUnitByKey.get('compute-tray.7')!;
    const slot = model.trayLayout(unit.componentId)!.slots.find((s) => s.face === 'front' && s.label)!;
    const path = plates.find((p) => p.unitKey === 'compute-tray.7' && model.slotFor(unit.componentId, p.path.split('/').slice(1).join('/')) === slot)!.path;
    expect(hoverTagText(path, en)).toBe(`${slot.label} · Compute tray 7`);
  });

  it('falls back to the part name and number, and translates the unit', () => {
    const plate = plates.find((p) => p.unitKey === 'tor-switch.1' && p.component === 'tor-rj45-port')!;
    const text = hoverTagText(plate.path, en)!;
    expect(text).toMatch(/ \d+ · Top-of-rack Ethernet switch 1$/);
    const tr = hoverTagText(plate.path, i18nFor('tr'))!;
    expect(tr).toContain(' · ');
    expect(tr).not.toBe(text);
  });

  it('has a tag for every front part', () => {
    for (const p of plates) expect(hoverTagText(p.path, en), p.path).not.toBeNull();
  });

  it('has none for a path that is not a rack unit', () => {
    expect(hoverTagText('rack', en)).toBeNull();
    expect(hoverTagText('compute-tray.7/no-such-part', en)).toBeNull();
  });
});

describe('clicking a front part', () => {
  const path = 'compute-tray.7/x.1';
  it('selects the unit first, then the part, then opens the unit', () => {
    expect(faceClickAction(path, '')).toBe('unit');
    expect(faceClickAction(path, 'compute-tray.6')).toBe('unit');
    expect(faceClickAction(path, 'compute-tray.7')).toBe('part');
    expect(faceClickAction(path, 'compute-tray.7/y.2')).toBe('part');
    expect(faceClickAction(path, path)).toBe('tray');
  });
});
