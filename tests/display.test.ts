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
        // Never the selection or hover colour, and never NVIDIA's callout green from its figures.
        expect([display.colors.selected, display.colors.hover, '#88b634', '#96be4b'], `${kind} ${theme}`).not.toContain(color);
      }
    }
  });

  it('draws coolant as a pipe and power as a ribbon', () => {
    expect(display.links.coolant.shape).toBe('pipe');
    expect(display.links.power.shape).toBe('ribbon');
    for (const k of ['pcie', 'c2c', 'clink', 'nvlink'] as const) expect(display.links[k].shape).toBe('signal');
  });
});
