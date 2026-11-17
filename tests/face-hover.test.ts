import { describe, expect, it } from 'vitest';
import { model } from '../src/data';
import { i18nFor } from '../src/i18n';
import { facePartTagPosition, facePlateColor, facePlates, hoveredUnitKey, isFacePart } from '../src/scenes/FrontScene';
import { faceClickAction, hoverTag } from '../src/scenes/faceHover';
import { HOVER_COLOR, SELECTED_COLOR } from '../src/scenes/geometry';
import { readFileSync } from 'node:fs';

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
    expect(hoverTag('compute-tray.7', en)).toEqual({ part: null, unit: 'Compute tray 7' });
  });

  it("names a front part by NVIDIA's slot label when it has one, with its unit", () => {
    const unit = model.rackUnitByKey.get('compute-tray.7')!;
    const slot = model.trayLayout(unit.componentId)!.slots.find((s) => s.face === 'front' && s.label)!;
    const path = plates.find((p) => p.unitKey === 'compute-tray.7' && model.slotFor(unit.componentId, p.path.split('/').slice(1).join('/')) === slot)!.path;
    expect(hoverTag(path, en)).toEqual({ part: slot.label, unit: 'Compute tray 7' });
  });

  it('falls back to the part name and number, and translates the unit', () => {
    const plate = plates.find((p) => p.unitKey === 'tor-switch.1' && p.component === 'tor-rj45-port')!;
    const tag = hoverTag(plate.path, en)!;
    expect(tag.part).toMatch(/ \d+$/);
    expect(tag.unit).toBe('Top-of-rack Ethernet switch 1');
    const tr = hoverTag(plate.path, i18nFor('tr'))!;
    expect(tr.part).not.toBeNull();
    expect(tr.unit).not.toBe(tag.unit);
  });

  it('has a tag for every front part', () => {
    for (const p of plates) expect(hoverTag(p.path, en)?.part, p.path).toBeTruthy();
  });

  it('has none for a path that is not a rack unit', () => {
    expect(hoverTag('rack', en)).toBeNull();
    expect(hoverTag('compute-tray.7/no-such-part', en)).toBeNull();
  });
});

describe('clicking a front part', () => {
  const path = 'compute-tray.7/x.1';
  it('selects the unit first, as a click on the unit does', () => {
    expect(faceClickAction(path, '')).toBe('unit');
    expect(faceClickAction(path, 'compute-tray.6')).toBe('unit');
    expect(faceClickAction(path, 'compute-tray.6/x.1')).toBe('unit');
  });
  it('opens the unit on the second click, wherever on its face it lands', () => {
    expect(faceClickAction(path, 'compute-tray.7')).toBe('open');
    expect(faceClickAction(path, 'compute-tray.7/y.2')).toBe('open');
    expect(faceClickAction(path, path)).toBe('open');
  });
});

/** WCAG contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('front part highlight', () => {
  const plates = facePlates(null).filter((p) => !p.led);
  const plate = plates.find((p) => p.unitKey === 'compute-tray.7')!;
  const unitColors = [HOVER_COLOR, SELECTED_COLOR];

  it('lights the unit holding a hovered front part', () => {
    expect(hoveredUnitKey(plate.path)).toBe('compute-tray.7');
    expect(hoveredUnitKey('compute-tray.7')).toBe('compute-tray.7');
  });

  it('stands out from its lit unit when hovered or selected', () => {
    for (const color of [facePlateColor(plate, '', plate.path), facePlateColor(plate, plate.path, null)]) {
      // Hovered on a hovered or selected unit; selected on a selected unit.
      for (const unit of unitColors) expect(contrast(color, unit), `${color} on ${unit}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the part colour when neither', () => {
    expect(facePlateColor(plate, 'compute-tray.7', 'compute-tray.7')).toBe(plate.color);
  });
});

describe('hover tag style', () => {
  it('lets a front part tag wrap within a phone canvas', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const rule = /\.unit-hover-label \[data-label\] \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('white-space: normal');
    expect(rule).toMatch(/max-width: /);
  });
});
