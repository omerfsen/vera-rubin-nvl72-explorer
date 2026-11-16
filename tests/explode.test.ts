// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { model, topology } from '../src/data';
import { useExplorer } from '../src/state/store';
import { EXPLODE_FRONT, explodeOffsets, layerKey, scaleOffset, stepExplode } from '../src/scenes/explode';

const typeOf = (id: string) => model.getComponent(id)?.type ?? id;
const layouts = Object.entries(topology.trayLayouts ?? {});

describe('exploded view state', () => {
  it('starts assembled and toggles on and off', () => {
    expect(useExplorer.getState().exploded).toBe(false);
    useExplorer.getState().toggleExploded();
    expect(useExplorer.getState().exploded).toBe(true);
    useExplorer.getState().toggleExploded();
    expect(useExplorer.getState().exploded).toBe(false);
  });

  it('keeps the selection and tray stepping working while exploded', () => {
    useExplorer.setState({ selected: 'compute-tray.4', view: 'tray', exploded: true });
    useExplorer.getState().stepTrayPart(1);
    expect(useExplorer.getState().selected).toBe('compute-tray.4/rubin-gpu.1');
    expect(useExplorer.getState().exploded).toBe(true);
    useExplorer.setState({ exploded: false });
  });
});

describe('explodeOffsets', () => {
  it('has layouts to test', () => expect(layouts.length).toBeGreaterThan(0));

  for (const [id, layout] of layouts) {
    describe(id, () => {
      const offsets = explodeOffsets(layout, typeOf);

      it('gives every slot an offset', () => {
        expect(offsets).toHaveLength(layout.slots.length);
        for (const o of offsets) for (const v of o) expect(Number.isFinite(v)).toBe(true);
      });

      it('moves front-face parts out of the tray, not up', () => {
        layout.slots.forEach((s, i) => {
          if (s.face === 'front') expect(offsets[i]).toEqual([0, 0, EXPLODE_FRONT]);
        });
      });

      it('lifts every top layer by a different height, the first one not at all', () => {
        const heightOf = new Map<string, number>();
        layout.slots.forEach((s, i) => {
          if (s.face !== 'top') return;
          const key = layerKey(s, typeOf);
          const y = offsets[i]![1];
          // Spread away from the centre: same sign as the slot's position.
          expect(offsets[i]![0] * s.x).toBeGreaterThanOrEqual(0);
          expect(offsets[i]![2] * s.z).toBeGreaterThanOrEqual(0);
          if (heightOf.has(key)) expect(y, key).toBe(heightOf.get(key));
          heightOf.set(key, y);
        });
        const heights = [...heightOf.values()];
        if (heights.length === 0) return;
        expect(new Set(heights).size).toBe(heights.length);
        expect(Math.min(...heights)).toBe(0);
      });

      it('keeps stacked rows in their bottom-to-top order', () => {
        const rows = layout.slots
          .map((s, i) => ({ s, y: offsets[i]![1] }))
          .filter(({ s }) => s.face === 'top' && s.y !== undefined)
          .sort((a, b) => a.s.y! - b.s.y!);
        for (let i = 1; i < rows.length; i++) expect(rows[i]!.y).toBeGreaterThanOrEqual(rows[i - 1]!.y);
      });
    });
  }

  it('separates the compute tray by part type', () => {
    const layout = topology.trayLayouts!['compute-tray']!;
    const offsets = explodeOffsets(layout, typeOf);
    const types = new Set(layout.slots.filter((s) => s.face === 'top').map((s) => typeOf(s.component)));
    const heights = new Set(layout.slots.flatMap((s, i) => (s.face === 'top' ? [offsets[i]![1]] : [])));
    expect(heights.size).toBe(types.size);
  });
});

describe('explode animation', () => {
  it('scales offsets by the amount', () => {
    expect(scaleOffset([0, 0.2, 0.1], 0)).toEqual([0, 0, 0]);
    expect(scaleOffset([0, 0.2, 0.1], 0.5)).toEqual([0, 0.1, 0.05]);
    expect(scaleOffset(undefined, 1)).toEqual([0, 0, 0]);
  });

  it('eases towards the target and settles exactly', () => {
    let a = 0;
    let frames = 0;
    while (a !== 1 && frames < 200) {
      const next = stepExplode(a, 1, 1 / 60);
      expect(next).toBeGreaterThan(a);
      a = next;
      frames++;
    }
    expect(a).toBe(1);
    expect(frames).toBeLessThan(120);
    expect(stepExplode(1, 0, 0)).toBe(1);
    expect(stepExplode(0.5, 0.5, 1)).toBe(0.5);
  });
});
