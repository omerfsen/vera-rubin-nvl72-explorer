import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import schema from '../data/display.schema.json';
import display from '../data/display.json';
import { topology } from '../src/data';

describe('data/display.json', () => {
  it('matches its schema', () => {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    expect(validate(display), JSON.stringify(validate.errors)).toBe(true);
  });

  it('has a colour for every unit type, network and link kind the data uses', () => {
    const unitTypes = new Set(topology.rackLayout.groups.map((g) => topology.components.find((c) => c.id === g.component)!.type));
    for (const t of unitTypes) expect(display.colors.unitTypes, t).toHaveProperty(t);
    for (const n of topology.networks) expect(display.colors.networks, n.id).toHaveProperty(n.id);
    const kinds = new Set([
      ...Object.values(topology.trayLayouts ?? {}).flatMap((l) => (l.links ?? []).map((k) => k.kind)),
      ...(topology.rearLayout?.unitConnectors ?? []).map((u) => u.kind),
    ]);
    for (const k of kinds) expect(display.links, k).toHaveProperty(k);
  });

  it('gives every link kind a colour per theme that stands out from the tray floor', () => {
    const lum = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const contrast = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    for (const [kind, link] of Object.entries(display.links)) {
      for (const theme of ['dark', 'light'] as const) {
        const color = link.color[theme];
        expect(contrast(color, display.colors.scene[theme].trayBase), `${kind} ${theme}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  // RGB distance, not string equality: one step off a colour looks the same.
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const distance = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]!));
  const MIN_DISTANCE = 60;
  /** Colours a connection must not look like: selection, hover, every part, and NVIDIA's callout greens from its figures. */
  const avoid = (): [string, string][] => [
    ['selected', display.colors.selected],
    ['hover', display.colors.hover],
    ['NVIDIA figure green', '#88b634'],
    ['NVIDIA figure green (light)', '#96be4b'],
    ...Object.entries(display.colors.partTypes).map(([k, v]): [string, string] => [`part ${k}`, v]),
  ];

  it('keeps every link colour clear of the part, selection, hover and NVIDIA figure colours', () => {
    for (const [kind, link] of Object.entries(display.links))
      for (const theme of ['dark', 'light'] as const)
        for (const [name, other] of avoid())
          expect(distance(link.color[theme], other), `${kind} ${theme} vs ${name}`).toBeGreaterThan(MIN_DISTANCE);
  });

  it('the colour distance check fails for a colour one step from another', () => {
    expect(distance('#88b635', '#88b634')).toBeLessThan(MIN_DISTANCE);
    expect(distance('#38bdf9', display.colors.selected)).toBeLessThan(MIN_DISTANCE);
    expect(distance('#3aa0c5', display.colors.partTypes.manifold)).toBeLessThan(MIN_DISTANCE);
  });

  it('draws coolant as a pipe and power as a ribbon', () => {
    expect(display.links.coolant.shape).toBe('pipe');
    expect(display.links.power.shape).toBe('ribbon');
    for (const k of ['pcie', 'c2c', 'clink', 'nvlink'] as const) expect(display.links[k].shape).toBe('signal');
  });
});
