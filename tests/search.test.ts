import { describe, expect, it } from 'vitest';
import { model } from '../src/data';
import { search } from '../src/components/search';

const paths = (q: string) => search(model, q).map((h) => h.path);

describe('search', () => {
  it('finds parts by name, type and network', () => {
    expect(paths('gpu')).toContain('compute-tray/rubin-gpu');
    expect(paths('bluefield')).toContain('compute-tray/bluefield-4');
    expect(paths('storagenet')).toContain('compute-tray/bluefield-4/ct-port-bf4-right');
  });

  it('finds numbered rack units in rack order', () => {
    expect(paths('compute tray 7')[0]).toBe('compute-tray.7');
    expect(paths('tray 7')).toEqual(['compute-tray.7', 'switch-tray.7']);
    expect(paths('switch tray 3')).toEqual(['switch-tray.3']);
    expect(paths('tray 1')).not.toContain('compute-tray.10');
  });

  it('finds numbered parts', () => {
    expect(paths('gpu 2')).toEqual(['compute-tray/rubin-gpu.2']);
    expect(paths('psu 3')).toEqual(['power-shelf/psu.3']);
    expect(paths('gpu 9')).toEqual([]);
  });

  it('treats a number in a name as part of the name', () => {
    expect(paths('nvlink 6')[0]).toBe('switch-tray');
    expect(paths('bluefield 4')).toContain('compute-tray/bluefield-4');
    expect(paths('nvlink 6 switch tray 3')).toEqual(['switch-tray.3']);
  });

  it('returns nothing for an empty query', () => {
    expect(search(model, '   ')).toEqual([]);
  });
});
