import { describe, expect, it } from 'vitest';
import { topology } from '../src/data';
// @ts-expect-error plain JS module shared with the generator script
import { computeReferences } from '../scripts/references.mjs';

describe('component references', () => {
  const computed = computeReferences(topology) as Record<string, unknown>;

  it('are up to date with the facts (run npm run data:refs after editing the data)', () => {
    for (const c of topology.components) expect(c.references, c.id).toEqual(computed[c.id]);
  });

  it('give every component at least one document link, and a PDF page for every section', () => {
    for (const c of topology.components) {
      expect(c.references.length, c.id).toBeGreaterThan(0);
      for (const r of c.references) expect(r.pdf, `${c.id} ${r.section}`).toMatch(/#page=\d+$/);
    }
  });
});
