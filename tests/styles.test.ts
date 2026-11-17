import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('styles.css', () => {
  it('closes every block it opens', () => {
    // Strip comments and strings, then walk the braces.
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
    let depth = 0;
    for (const ch of css) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });
});

describe('tray connection controls', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

  it('keeps a hidden kind in the legend readable: only its swatch fades', () => {
    const off = css.match(/\.link-legend \.link-kind\[aria-pressed="false"\] \{([^}]*)\}/)![1]!;
    expect(off).not.toMatch(/opacity/);
    expect(off).toMatch(/color: var\(--muted\)/);
    expect(css).toMatch(/\.link-legend \.link-kind\[aria-pressed="false"\] \.line-swatch \{[^}]*opacity/);
  });

  it('gives the legend toggles, Show in 3D and Unpin touch targets of at least 24px on phones', () => {
    const block = css.match(/@media \(max-width: 760px\), \(pointer: coarse\) \{([\s\S]*?)\n\}/)![1]!;
    for (const sel of ['.link-legend .link-kind', '.show-link', '.pinned-connection .unpin']) {
      const rule = block.split('\n').find((l) => l.includes(sel))!;
      expect(rule, sel).toBeDefined();
      expect(Number(rule.match(/min-height: (\d+)px/)![1]), sel).toBeGreaterThanOrEqual(24);
    }
  });
});
