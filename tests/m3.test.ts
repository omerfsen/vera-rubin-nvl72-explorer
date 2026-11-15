// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { model, topology } from '../src/data';
import { useExplorer } from '../src/state/store';
import { trayKeyOf } from '../src/state/url';
import { rearBoxes, rearSegments } from '../src/scenes/RearScene';

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

  it('opens switch trays and power shelves but not ToR switches', () => {
    expect(trayKeyOf('switch-tray.4', model)).toBe('switch-tray.4');
    expect(trayKeyOf('power-shelf.1/psu.3', model)).toBe('power-shelf.1');
    expect(trayKeyOf('tor-switch.1', model)).toBeNull();
  });
});

describe('rear of the rack', () => {
  const boxes = rearBoxes();
  const segments = rearSegments(boxes);

  it('draws the cartridges, two manifolds and the bus bar', () => {
    expect(boxes.map((b) => b.part.component).sort()).toEqual(
      ['bus-bar', 'liquid-cooling-manifold', 'liquid-cooling-manifold', 'nvlink-cable-cartridge'].sort(),
    );
    for (const b of boxes) expect(b.size[1], b.part.component).toBeGreaterThan(0);
  });

  it('connects every compute and switch tray to the cartridge over NVLink', () => {
    const nv = segments.filter((s) => s.kind === 'nvlink');
    expect(nv).toHaveLength(18 + 9);
    expect(new Set(nv.map((s) => s.rearPath))).toEqual(new Set(['nvlink-cable-cartridge']));
  });

  it('cools every compute and switch tray from both manifolds and powers them from the bus bar', () => {
    expect(segments.filter((s) => s.kind === 'cooling')).toHaveLength((18 + 9) * 2);
    const power = segments.filter((s) => s.kind === 'power');
    expect(power.filter((s) => s.unitKey.startsWith('power-shelf.'))).toHaveLength(4);
    expect(power.filter((s) => s.unitKey.startsWith('compute-tray.'))).toHaveLength(18);
    expect(power.filter((s) => s.unitKey.startsWith('switch-tray.') && s.assumed)).toHaveLength(9);
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
