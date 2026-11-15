// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { model, topology } from '../src/data';
import { useExplorer } from '../src/state/store';
import { trayKeyOf } from '../src/state/url';
import { fabricSegments, rearBoxes, rearSegments, unitConnectorBoxes } from '../src/scenes/RearScene';

const descendants = (id: string): string[] =>
  topology.components.filter((c) => model.ancestorsOf(c.id).includes(id)).map((c) => c.id);

describe.each(Object.keys(topology.trayLayouts ?? {}))('tray layout of %s', (trayId) => {
  const layout = topology.trayLayouts![trayId]!;

  it('places every part inside, or says why not', () => {
    const notPlaced = new Set((layout.notPlaced ?? []).map((n) => n.component));
    for (const id of descendants(trayId)) {
      if (notPlaced.has(id)) continue;
      const c = model.getComponent(id)!;
      const slots = layout.slots.filter((s) => s.component === id);
      if (c.count === null) expect(slots.length, id).toBeGreaterThan(0);
      else expect(slots.map((s) => s.index).sort((a, b) => a! - b!), id).toEqual(Array.from({ length: c.count }, (_, i) => i + 1));
    }
  });

  it('only places its own parts, and every slot is selectable', () => {
    const inside = new Set(descendants(trayId));
    for (const s of layout.slots) {
      expect(inside, s.component).toContain(s.component);
      expect(model.parsePath(`${trayId}.1/${model.slotPathWithin(trayId, s)}`), s.component).not.toBeNull();
    }
  });

  it('ends every link on a placed part or a named point', () => {
    const points = new Set((layout.points ?? []).map((p) => p.id));
    for (const l of layout.links ?? []) {
      for (const end of [l.from, l.to]) {
        if (end.point !== undefined) expect(points).toContain(end.point);
        else expect(layout.slots.some((s) => s.component === end.component && s.index === end.index)).toBe(true);
      }
      if (l.assumed) expect(l.note).toBeTruthy();
    }
  });

  it('is marked schematic', () => {
    expect(layout.assumed).toBe(true);
  });
});

describe('switch tray and power shelf specifics', () => {
  it('numbers PSUs 1 to 6 left to right, top to bottom, as in the service manual', () => {
    const psus = topology.trayLayouts!['power-shelf']!.slots.filter((s) => s.component === 'psu');
    const order = [...psus].sort((a, b) => b.y! - a.y! || a.x - b.x).map((s) => s.index);
    expect(order).toEqual([1, 2, 3, 4, 5, 6]);
    expect(topology.trayLayouts!['power-shelf']!.heightRU).toBe(3);
  });

  it('puts the five switch tray ports on the front panel in the 2.5 table order', () => {
    const front = topology.trayLayouts!['switch-tray']!.slots.filter((s) => s.face === 'front').sort((a, b) => a.x - b.x);
    expect(front.map((s) => s.component)).toEqual([
      'st-port-rs232', 'st-port-bmc-eth', 'st-port-switch-mgmt', 'st-port-switch-mgmt', 'st-port-leakage',
    ]);
  });

  it('opens switch trays, power shelves and ToR switches, but not rear parts', () => {
    expect(trayKeyOf('switch-tray.4', model)).toBe('switch-tray.4');
    expect(trayKeyOf('power-shelf.1/psu.3', model)).toBe('power-shelf.1');
    expect(trayKeyOf('tor-switch.1', model)).toBe('tor-switch.1');
    expect(trayKeyOf('bus-bar', model)).toBeNull();
  });
});

describe('rear of the rack', () => {
  const boxes = rearBoxes();
  const segments = rearSegments(boxes);

  it('draws the cartridges, two manifolds, the bus bar, FD83 connectors, supports, bracing and bezel', () => {
    const count = (id: string) => boxes.filter((b) => b.part.component === id).length;
    expect(count('nvlink-cable-cartridge')).toBe(1);
    expect(count('liquid-cooling-manifold')).toBe(2);
    expect(count('bus-bar')).toBe(1);
    expect(count('fd83-connector')).toBe(4);
    expect(count('rear-supports')).toBe(2);
    expect(count('seismic-bracing')).toBe(1);
    expect(count('rear-bezel')).toBe(1);
    for (const b of boxes) expect(b.size[1], b.part.component).toBeGreaterThan(0);
  });

  it('puts the connectors from the guide on the back of every unit', () => {
    const c = unitConnectorBoxes();
    const of = (suffix: string) => c.filter((x) => x.path.endsWith(suffix));
    expect(of('/ct-nvlink-connectors')).toHaveLength(18);
    expect(of('/ct-cold-water-inlet')).toHaveLength(18);
    expect(of('/st-power-connector')).toHaveLength(9);
    expect(c.filter((x) => x.kind === 'ac')).toHaveLength(4 * 2);
    for (const x of c) expect(model.parsePath(x.path), x.path).not.toBeNull();
  });

  it('only wires a connector to a rear part that a type-level connection names', () => {
    const layout = topology.rearLayout!;
    for (const uc of layout.unitConnectors ?? []) {
      if (uc.toPart === undefined) continue;
      const rear = layout.parts[uc.toPart]!.component;
      const ok = topology.connections.some(
        (x) => (x.from === uc.unit && x.to === rear) || (x.from === rear && x.to === uc.unit),
      );
      expect(ok, `${uc.component} -> ${rear}`).toBe(true);
      expect(model.getComponent(uc.component)?.parent, uc.component).toBe(uc.unit);
    }
  });

  it('connects trays to the cartridge, manifolds and bus bar, and power shelves to the bus bar', () => {
    expect(segments.filter((s) => s.kind === 'nvlink')).toHaveLength(18 + 9);
    expect(segments.filter((s) => s.kind === 'cooling')).toHaveLength((18 + 9) * 2);
    expect(segments.filter((s) => s.kind === 'power')).toHaveLength(18 + 9 + 4);
    expect(segments.filter((s) => s.kind === 'ac')).toHaveLength(8);
  });

  it('fans a compute tray out to all 9 switch trays, and a switch tray to all 18 compute trays', () => {
    expect(fabricSegments('compute-tray.7', boxes).map((s) => s.rearPath)).toEqual(
      Array.from({ length: 9 }, (_, i) => `switch-tray.${i + 1}`),
    );
    expect(fabricSegments('switch-tray.2', boxes)).toHaveLength(18);
    expect(fabricSegments('power-shelf.1', boxes)).toEqual([]);
  });

  describe('view', () => {
    beforeEach(() => useExplorer.setState({ view: 'rack', selected: '' }));
    it('turns to the rear when a rear part is selected', () => {
      useExplorer.getState().select('bus-bar');
      expect(useExplorer.getState().view).toBe('rear');
      useExplorer.getState().select('compute-tray.3');
      expect(useExplorer.getState().view).toBe('rear');
      useExplorer.getState().setSide('rack');
      expect(useExplorer.getState().view).toBe('rack');
    });
  });
});

describe('power shelf and ToR detail', () => {
  it('counts 48 RJ45 ports, 4 larger cages and 3 side ports on the ToR switch, all placed on its front', () => {
    const tor = topology.trayLayouts!['tor-switch']!;
    const n = (id: string) => tor.slots.filter((s) => s.component === id && s.face === 'front').length;
    expect(n('tor-rj45-port')).toBe(48);
    expect(n('tor-uplink-cage')).toBe(4);
    expect(n('tor-side-port')).toBe(3);
  });

  it('gives every PSU a power and a fault LED', () => {
    const psus = topology.trayLayouts!['power-shelf']!.slots.filter((s) => s.component === 'psu');
    for (const p of psus) expect(p.indicators?.map((i) => i.color)).toEqual(['green', 'amber']);
  });
});
