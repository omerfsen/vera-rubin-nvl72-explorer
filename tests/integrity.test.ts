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

  it('backs every network a component claims with a sourced connection from it or a part inside it', () => {
    for (const c of topology.components) {
      const own = [c.id, ...topology.components.filter((d) => model.ancestorsOf(d.id).includes(c.id)).map((d) => d.id)];
      for (const n of c.networks) {
        const hit = topology.connections.some((x) => own.includes(x.from) && x.network === n);
        expect(hit, `${c.id} on ${n}`).toBe(true);
      }
    }
  });

  it('lists the network on every component that has a connection to it', () => {
    for (const x of topology.connections) {
      if (x.network && !x.alternative) expect(model.getComponent(x.from)?.networks, x.id).toContain(x.network);
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

  it('gives a height for every component in the rack layout, and only for those', () => {
    const inLayout = new Set(topology.rackLayout.groups.map((g) => g.component));
    for (const id of inLayout) expect(topology.rackLayout.heightsRU?.[id], id).toBeDefined();
    for (const id of Object.keys(topology.rackLayout.heightsRU ?? {})) expect(inLayout, id).toContain(id);
  });

  it('keeps specs that repeat a count or height in step with it', () => {
    const spec = (id: string, label: string) => model.getComponent(id)?.specs.find((s) => s.label === label)?.value;
    expect(spec('rack', 'Compute trays')).toBe(model.getComponent('compute-tray')?.count);
    expect(spec('rack', 'NVLink 6 switch trays')).toBe(model.getComponent('switch-tray')?.count);
    expect(spec('rack', 'Top-of-rack management switches')).toBe(model.getComponent('tor-switch')?.count);
    expect(spec('rack', 'Power shelves')).toBe(model.getComponent('power-shelf')?.count);
    expect(spec('rack', 'GPUs in the NVLink domain')).toBe(model.totalPerRack('rubin-gpu'));
    expect(spec('switch-tray', 'NVSwitch ASICs')).toBe(model.getComponent('nvswitch-asic')?.count);
    expect(spec('power-shelf', 'PSUs')).toBe(model.getComponent('psu')?.count);
    for (const id of ['compute-tray', 'switch-tray', 'power-shelf']) {
      expect(spec(id, 'Height'), id).toBe(model.heightRU(id));
    }
  });
});

describe('facts the brief extracted from the guide', () => {
  const count = (id: string) => model.getComponent(id)?.count;
  const value = (id: string, label: string) => model.getComponent(id)?.specs.find((s) => s.label === label)?.value;
  const portLink = (port: string) => topology.connections.find((x) => x.from === port);

  it('compute tray: 2 CPUs, 4 GPUs, 2 ConnectX-9, 1 BlueField-4, 4 cache drives in RAID 0, 1 boot drive', () => {
    expect(count('vera-cpu')).toBe(2);
    expect(count('rubin-gpu')).toBe(4);
    expect(count('connectx-9')).toBe(2);
    expect(count('bluefield-4')).toBe(1);
    expect(count('e1s-cache-drive')).toBe(4);
    expect(count('e1s-boot-drive')).toBe(1);
    expect(String(value('e1s-cache-drive', 'RAID level'))).toMatch(/RAID 0/);
  });

  it('switch tray: 4 NVSwitch ASICs with 72 NVLink 6 ports each', () => {
    expect(count('nvswitch-asic')).toBe(4);
    expect(value('nvswitch-asic', 'NVLink 6 ports')).toBe(72);
  });

  it('power shelf: 3 RU, 110 kW, 6 x 18.3 kW PSUs, 2 x 100 A at 415-480 V AC in, 54 V DC out', () => {
    expect(value('power-shelf', 'Height')).toBe(3);
    expect(value('power-shelf', 'Rating')).toBe(110);
    expect(value('power-shelf', 'AC input')).toBe('2 x 100 A whips at 415-480 V AC');
    expect(value('power-shelf', 'DC output')).toBe(54);
    expect(value('psu', 'Rating')).toBe(18.3);
  });

  it('maps every compute and switch tray port to the network in tables 2.3 and 2.5', () => {
    expect(portLink('ct-port-cx9-osfp')?.network).toBe('computenet');
    expect(portLink('ct-port-bf4-left')?.network).toBe('dgxnet');
    expect(portLink('ct-port-bf4-right')?.network).toBe('storagenet');
    expect(portLink('ct-port-bf4-rj45')?.network).toBe('ipminet');
    expect(portLink('ct-port-bmc-1gbe')?.network).toBe('ipminet');
    expect(portLink('ct-port-lan-1gbe')?.kind).toBe('not-connected');
    expect(portLink('st-port-bmc-eth')?.network).toBe('ipminet');
    expect(portLink('st-port-switch-mgmt')?.network).toBe('ipminet');
    expect(portLink('st-port-rs232')?.kind).toBe('not-connected');
    expect(portLink('st-port-leakage')?.kind).toBe('not-connected');
    expect(count('st-port-switch-mgmt')).toBe(2);
  });

  it('flags the BlueField-4 left port conflict between Table 2.3 and Fig. 1', () => {
    expect(model.getComponent('ct-port-bf4-left')?.note).toMatch(/storagenet/);
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
