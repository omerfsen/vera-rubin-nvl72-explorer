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
});
