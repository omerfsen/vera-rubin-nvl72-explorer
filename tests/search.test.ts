import { describe, expect, it } from 'vitest';
import { model } from '../src/data';
import { search } from '../src/components/search';

describe('search', () => {
  it('finds parts by name, type and network', () => {
    expect(search(model, 'gpu').map((h) => h.path)).toContain('compute-tray/rubin-gpu');
    expect(search(model, 'bluefield').map((h) => h.path)).toContain('compute-tray/bluefield-4');
    expect(search(model, 'storagenet').map((h) => h.path)).toContain('compute-tray/bluefield-4/ct-port-bf4-right');
  });

  it('finds a numbered rack unit first', () => {
    expect(search(model, 'compute tray 7')[0]?.path).toBe('compute-tray.7');
    expect(search(model, 'switch tray 3')[0]?.path).toBe('switch-tray.3');
    expect(search(model, 'tray 1').map((h) => h.path)).not.toContain('compute-tray.10');
  });

  it('returns nothing for an empty query', () => {
    expect(search(model, '   ')).toEqual([]);
  });
});
