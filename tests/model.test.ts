import { describe, expect, it } from 'vitest';
import { model } from '../src/data';

describe('rack units', () => {
  it('numbers each type from the top down, continuing across groups', () => {
    const trays = model.rackUnits.filter((u) => u.componentId === 'compute-tray');
    expect(trays.map((u) => u.index)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(trays[10]!.group).toBe(4); // tray 11 is the first one below the switch trays
  });

  it('numbers power shelves from the bottom up, as the service manual does', () => {
    const shelves = model.rackUnits.filter((u) => u.componentId === 'power-shelf');
    expect(shelves.map((u) => u.index)).toEqual([4, 3, 2, 1]);
    expect(model.rackUnits[model.rackUnits.length - 1]!.key).toBe('power-shelf.1');
  });

  it('stacks without gaps and adds up the heights', () => {
    let top = 0;
    for (const u of model.rackUnits) {
      expect(u.topRU).toBe(top);
      top += u.heightRU;
    }
    // 2 x ToR (1 RU, assumed) + 4 x 3 RU shelves + 18 + 9 trays
    expect(model.totalRU).toBe(2 + 12 + 18 + 9);
  });
});

describe('selection paths', () => {
  it('parses and formats rack units and parts', () => {
    expect(model.parsePath('')).toEqual([]);
    expect(model.parsePath('compute-tray.7')).toEqual([{ id: 'compute-tray', index: 7 }]);
    expect(model.parsePath('compute-tray.7/rubin-gpu.2')).toEqual([
      { id: 'compute-tray', index: 7 },
      { id: 'rubin-gpu', index: 2 },
    ]);
    expect(model.formatPath(model.parsePath('switch-tray.9/nvswitch-asic')!)).toBe('switch-tray.9/nvswitch-asic');
  });

  it('rejects paths that break the parent chain or go out of range', () => {
    expect(model.parsePath('rubin-gpu')).toBeNull();
    expect(model.parsePath('compute-tray.19')).toBeNull();
    expect(model.parsePath('compute-tray.0')).toBeNull();
    expect(model.parsePath('compute-tray.7/rubin-gpu.5')).toBeNull();
    expect(model.parsePath('switch-tray.1/rubin-gpu')).toBeNull();
    expect(model.parsePath('nope')).toBeNull();
    expect(model.parsePath('compute-tray.7//')).toBeNull();
    expect(model.parsePath('hmc.1')).toBeNull(); // hmc is not a child of the rack
    expect(model.parsePath('compute-tray.1/hmc.1')).toBeNull(); // HMC count is not stated
  });

  it('labels segments for the breadcrumb', () => {
    const [tray, gpu] = model.parsePath('compute-tray.7/rubin-gpu.2')!;
    expect(model.segmentLabel(tray!)).toBe('Compute tray 7');
    expect(model.segmentLabel(gpu!)).toBe('Rubin GPU 2');
  });

  it('builds a general path for any component', () => {
    expect(model.pathForComponent('rack')).toBe('');
    expect(model.pathForComponent('ct-port-bf4-left')).toBe('compute-tray/bluefield-4/ct-port-bf4-left');
    expect(model.parsePath(model.pathForComponent('ct-port-bf4-left'))).not.toBeNull();
  });
});

describe('networks', () => {
  it('collects the networks of a compute tray from its parts, in guide order', () => {
    expect(model.networksWithin('compute-tray').map((n) => n.id)).toEqual([
      'dgxnet', 'ipminet', 'computenet', 'storagenet',
    ]);
  });
});
