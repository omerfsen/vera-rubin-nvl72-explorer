import { describe, expect, it } from 'vitest';
import { model, topology } from '../src/data';

const ids = new Set(topology.components.map((c) => c.id));
const networkIds = new Set(topology.networks.map((n) => n.id));

describe('references inside the data file', () => {
  it('has unique ids', () => {
    expect(ids.size).toBe(topology.components.length);
    expect(networkIds.size).toBe(topology.networks.length);
    expect(new Set(topology.connections.map((c) => c.id)).size).toBe(topology.connections.length);
  });

  it('has exactly one root, the rack, and every parent exists', () => {
    const roots = topology.components.filter((c) => c.parent === null);
    expect(roots.map((r) => r.id)).toEqual(['rack']);
    for (const c of topology.components) {
      if (c.parent !== null) expect(ids, `${c.id} -> ${c.parent}`).toContain(c.parent);
      expect(() => model.ancestorsOf(c.id)).not.toThrow();
    }
  });

  it('only names networks that exist', () => {
    for (const c of topology.components) for (const n of c.networks) expect(networkIds, c.id).toContain(n);
  });

  it('numbers the seven networks 1 to 7 as in the guide', () => {
    expect(topology.networks.map((n) => n.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(topology.networks.map((n) => n.id)).toEqual([
      'externalnet', 'internalnet', 'dgxnet', 'ipminet', 'computenet', 'storagenet', 'failovernet',
    ]);
  });

  it('points connections at real components and networks', () => {
    for (const c of topology.connections) {
      expect(ids, c.id).toContain(c.from);
      if (c.to) expect(ids, c.id).toContain(c.to);
      if (c.network) expect(networkIds, c.id).toContain(c.network);
      if (c.kind === 'network') expect(c.to ?? c.network, c.id).toBeTruthy();
      if (c.kind === 'not-connected') expect(c.to ?? c.network, c.id).toBeUndefined();
    }
  });

  it('backs every network a component claims with a sourced connection', () => {
    for (const c of topology.components) {
      for (const n of c.networks) {
        const backed = [c.id, ...topology.components.filter((d) => model.ancestorsOf(d.id).includes(c.id)).map((d) => d.id)];
        const hit = topology.connections.some((x) => backed.includes(x.from) && x.network === n);
        const viaTor = n === 'ipminet' && topology.connections.some((x) => x.from === c.id && x.to === 'tor-switch');
        expect(hit || viaTor, `${c.id} on ${n}`).toBe(true);
      }
    }
  });

  it('places in the rack layout exactly as many units as each component count says', () => {
    const placed = new Map<string, number>();
    for (const g of topology.rackLayout.groups) {
      expect(model.getComponent(g.component)?.parent, g.component).toBe('rack');
      placed.set(g.component, (placed.get(g.component) ?? 0) + g.count);
    }
    for (const [id, count] of placed) expect(model.getComponent(id)?.count, id).toBe(count);
  });

  it('gives a height for every component in the rack layout', () => {
    for (const g of topology.rackLayout.groups) expect(topology.rackLayout.heightsRU?.[g.component], g.component).toBeDefined();
  });
});

describe('facts from the guide', () => {
  const count = (id: string) => model.getComponent(id)?.count;

  it('rack: 18 compute trays, 9 switch trays, 2 ToR switches, 4 power shelves', () => {
    expect(count('compute-tray')).toBe(18);
    expect(count('switch-tray')).toBe(9);
    expect(count('tor-switch')).toBe(2);
    expect(count('power-shelf')).toBe(4);
  });

  it('72 GPUs and 36 CPUs per rack', () => {
    expect(model.totalPerRack('rubin-gpu')).toBe(72);
    expect(model.totalPerRack('vera-cpu')).toBe(36);
  });

  it('36 NVSwitch ASICs per rack and 24 PSUs', () => {
    expect(model.totalPerRack('nvswitch-asic')).toBe(36);
    expect(model.totalPerRack('psu')).toBe(24);
  });

  it('stacks the rack as in Fig. 1, top to bottom', () => {
    expect(topology.rackLayout.groups).toEqual([
      { component: 'tor-switch', count: 2 },
      { component: 'power-shelf', count: 2 },
      { component: 'compute-tray', count: 10 },
      { component: 'switch-tray', count: 9 },
      { component: 'compute-tray', count: 8 },
      { component: 'power-shelf', count: 2 },
    ]);
  });
});
