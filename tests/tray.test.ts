// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { model, topology } from '../src/data';
import { readUrlState, trayKeyOf, writeUrlState } from '../src/state/url';
import { useExplorer } from '../src/state/store';
import { isPartSelected, partColor, trayLegend } from '../src/scenes/colors';

const layout = topology.trayLayouts!['compute-tray']!;
const descendants = (id: string): string[] =>
  topology.components.filter((c) => model.ancestorsOf(c.id).includes(id)).map((c) => c.id);

describe('compute tray layout data', () => {
  it('only places parts that live inside the compute tray', () => {
    const inside = new Set(descendants('compute-tray'));
    for (const s of layout.slots) expect(inside, s.component).toContain(s.component);
  });

  it('places every instance of every part, or says why not', () => {
    const notPlaced = new Set((layout.notPlaced ?? []).map((n) => n.component));
    for (const id of descendants('compute-tray')) {
      if (notPlaced.has(id)) continue;
      const c = model.getComponent(id)!;
      const slots = layout.slots.filter((s) => s.component === id);
      if (c.count === null) {
        expect(slots.length, id).toBeGreaterThan(0);
        for (const s of slots) expect(s.index, id).toBeUndefined();
      } else {
        expect(slots.map((s) => s.index).sort((a, b) => a! - b!), id).toEqual(Array.from({ length: c.count }, (_, i) => i + 1));
      }
    }
  });

  it('gives every slot a path that the app can select', () => {
    for (const s of layout.slots) {
      const path = `compute-tray.7/${model.slotPathWithin('compute-tray', s)}`;
      expect(model.parsePath(path), path).not.toBeNull();
    }
  });

  it('labels the GPUs and CPUs with NVIDIA names from the PCIe labels figure', () => {
    const label = (component: string, index: number) => layout.slots.find((s) => s.component === component && s.index === index)?.label;
    expect(label('rubin-gpu', 1)).toBe('GPU0 (HPM_L GPU_0)');
    expect(label('rubin-gpu', 4)).toBe('GPU3 (HPM_R GPU_3)');
    expect(label('vera-cpu', 2)).toBe('CPU1 (HPM_R)');
  });

  it('marks the whole layout as schematic', () => {
    expect(layout.assumed).toBe(true);
    expect(layout.note).toMatch(/schematic/i);
  });
});

describe('tray helpers', () => {
  it('builds paths for parts and ports', () => {
    const gpu = layout.slots.find((s) => s.component === 'rubin-gpu' && s.index === 2)!;
    expect(model.slotPathWithin('compute-tray', gpu)).toBe('rubin-gpu.2');
    const cage = layout.slots.find((s) => s.component === 'ct-port-cx9-osfp')!;
    expect(model.slotPathWithin('compute-tray', cage)).toBe('connectx-9/ct-port-cx9-osfp');
    expect(model.slotFor('compute-tray', 'rubin-gpu.2')).toBe(gpu);
  });

  it('highlights an instance for its own path and for a general selection of its type', () => {
    expect(isPartSelected('compute-tray.7/rubin-gpu.2', 'compute-tray.7/rubin-gpu.2')).toBe(true);
    expect(isPartSelected('compute-tray.7/rubin-gpu.2', 'compute-tray.7/rubin-gpu')).toBe(true);
    expect(isPartSelected('compute-tray.7/rubin-gpu.2', 'compute-tray.7/rubin-gpu.1')).toBe(false);
  });

  it('colours ports by connector and groups them in the legend', () => {
    expect(partColor('ct-port-cx9-osfp')).not.toBe(partColor('ct-port-bf4-left'));
    const labels = trayLegend('compute-tray').map((r) => r.label);
    expect(labels).toContain('OSFP port');
    expect(labels).toContain('QSFP port');
    expect(labels).toContain('Rubin GPU');
  });
});

describe('tray view state', () => {
  beforeEach(() => useExplorer.setState({ view: 'rack', selected: '', hovered: null }));
  const st = () => useExplorer.getState();

  it('opens only for a numbered unit that has a layout', () => {
    expect(trayKeyOf('compute-tray.7/rubin-gpu.2', model)).toBe('compute-tray.7');
    expect(trayKeyOf('compute-tray/rubin-gpu', model)).toBeNull();
    expect(trayKeyOf('switch-tray.3', model)).toBeNull();
    st().select('switch-tray.3');
    st().openTray();
    expect(st().view).toBe('rack');
    st().select('compute-tray.7');
    st().openTray();
    expect(st().view).toBe('tray');
  });

  it('steps through parts and goes back up to the rack with Escape', () => {
    st().select('compute-tray.7');
    st().openTray();
    st().stepTrayPart(1);
    expect(st().selected).toBe('compute-tray.7/rubin-gpu.1');
    st().stepTrayPart(1);
    expect(st().selected).toBe('compute-tray.7/rubin-gpu.2');
    st().goUp();
    expect(st().selected).toBe('compute-tray.7');
    expect(st().view).toBe('tray');
    st().goUp();
    expect(st().view).toBe('rack');
    expect(st().selected).toBe('compute-tray.7');
  });

  it('leaves the tray view when the selection moves outside an openable unit', () => {
    st().select('compute-tray.7');
    st().openTray();
    st().select('compute-tray.9/vera-cpu.1');
    expect(st().view).toBe('tray');
    st().select('power-shelf.2');
    expect(st().view).toBe('rack');
  });

  it('closes back to the tray itself', () => {
    st().select('compute-tray.7/bluefield-4');
    st().openTray();
    st().closeTray();
    expect(st().view).toBe('rack');
    expect(st().selected).toBe('compute-tray.7');
  });
});

describe('tray view in the URL', () => {
  it('round-trips view=tray and drops it when nothing openable is selected', () => {
    const search = writeUrlState('', { view: 'tray', select: 'compute-tray.7/rubin-gpu.2', list: false });
    expect(search).toBe('?view=tray&select=compute-tray.7/rubin-gpu.2');
    expect(readUrlState(search, model).view).toBe('tray');
    expect(readUrlState('?view=tray&select=power-shelf.2', model).view).toBe('rack');
    expect(readUrlState('?view=tray', model).view).toBe('rack');
  });
});
