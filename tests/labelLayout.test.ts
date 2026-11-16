import { describe, expect, it } from 'vitest';
import { overlaps, resolveLabels, type LabelBox } from '../src/scenes/labelLayout';

const box = (id: string, x: number, y: number, extra: Partial<LabelBox> = {}): LabelBox => ({
  id,
  x,
  y,
  width: 100,
  height: 16,
  ...extra,
});

function visibleBoxes(labels: LabelBox[], gap = 2) {
  const placements = resolveLabels(labels, { gap });
  return placements
    .map((p, i) => ({ p, l: labels[i]! }))
    .filter(({ p }) => p.visible)
    .map(({ p, l }) => ({ id: l.id, x: l.x + p.dx, y: l.y + p.dy, width: l.width, height: l.height }));
}

function assertNoOverlap(rects: { x: number; y: number; width: number; height: number }[], gap = 2) {
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i]!, rects[j]!, gap)).toBe(false);
}

/** Deterministic pseudo-random numbers, so a failure can be replayed. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('overlaps', () => {
  it('detects intersecting boxes and respects the gap', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(overlaps(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(overlaps(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(overlaps(a, { x: 11, y: 0, width: 10, height: 10 }, 2)).toBe(true);
    expect(overlaps(a, { x: 12, y: 0, width: 10, height: 10 }, 2)).toBe(false);
  });
});

describe('resolveLabels', () => {
  it('leaves labels that do not collide exactly where they are', () => {
    const labels = [box('a', 0, 0), box('b', 0, 40), box('c', 200, 0)];
    expect(resolveLabels(labels)).toEqual([
      { id: 'a', visible: true, dx: 0, dy: 0 },
      { id: 'b', visible: true, dx: 0, dy: 0 },
      { id: 'c', visible: true, dx: 0, dy: 0 },
    ]);
  });

  it('returns results in input order and handles an empty list', () => {
    expect(resolveLabels([])).toEqual([]);
    const out = resolveLabels([box('z', 0, 0), box('y', 0, 5, { priority: 9 })]);
    expect(out.map((p) => p.id)).toEqual(['z', 'y']);
  });

  it('nudges a lower-priority label to the nearest free spot', () => {
    const out = resolveLabels([box('big', 0, 100, { priority: 10 }), box('small', 0, 108, { priority: 1 })], { gap: 2 });
    expect(out[0]).toEqual({ id: 'big', visible: true, dx: 0, dy: 0 });
    // Just below "big" (100 + 16 + 2 = 118) is 10 px away; just above (82) is 26.
    expect(out[1]).toEqual({ id: 'small', visible: true, dx: 0, dy: 10 });
  });

  it('hides a label that cannot move within maxShift', () => {
    const labels = [box('a', 0, 0, { priority: 2 }), box('b', 0, 0, { priority: 1 })];
    const out = resolveLabels(labels, { maxShift: 5 });
    expect(out[0]!.visible).toBe(true);
    expect(out[1]).toEqual({ id: 'b', visible: false, dx: 0, dy: 0 });
  });

  it('keeps a pinned label visible and in place, even over higher priorities', () => {
    const labels = [
      box('a', 0, 0, { priority: 100 }),
      box('b', 0, 2, { priority: 50 }),
      box('pinned', 0, 4, { priority: 0, pinned: true }),
    ];
    const out = resolveLabels(labels, { maxShift: 0 });
    expect(out[2]).toEqual({ id: 'pinned', visible: true, dx: 0, dy: 0 });
    expect(out[0]!.visible).toBe(false);
    expect(out[1]!.visible).toBe(false);
  });

  it('breaks priority ties by input order', () => {
    const out = resolveLabels([box('first', 0, 0), box('second', 0, 0)], { maxShift: 0 });
    expect(out.map((p) => p.visible)).toEqual([true, false]);
  });

  it('never leaves visible labels overlapping, for many random layouts', () => {
    const rand = rng(42);
    for (let run = 0; run < 200; run++) {
      const labels = Array.from({ length: 2 + Math.floor(rand() * 12) }, (_, i) =>
        box(`l${i}`, Math.floor(rand() * 150), Math.floor(rand() * 120), {
          width: 30 + Math.floor(rand() * 90),
          height: 12 + Math.floor(rand() * 8),
          priority: Math.floor(rand() * 5),
          pinned: i === 0,
        }),
      );
      assertNoOverlap(visibleBoxes(labels));
      // The pinned label is always shown.
      expect(resolveLabels(labels)[0]!.visible).toBe(true);
    }
  });

  it('is deterministic: the same input gives the same output', () => {
    const labels = [box('a', 0, 0), box('b', 10, 6), box('c', 20, 12), box('d', 30, 18)];
    expect(resolveLabels(labels)).toEqual(resolveLabels(labels));
  });

  it('stacks a column of labels squeezed together when zoomed out', () => {
    // Six labels on the left of the rack, 6 px apart vertically.
    const labels = Array.from({ length: 6 }, (_, i) => box(`g${i}`, 0, 200 + i * 6, { priority: 6 - i }));
    const visible = visibleBoxes(labels);
    assertNoOverlap(visible);
    expect(visible.some((v) => v.id === 'g0')).toBe(true);
  });
});
