import { describe, expect, it } from 'vitest';
import { model } from '../src/data';
import { readUrlState, writeUrlState } from '../src/state/url';

describe('URL state', () => {
  it('round-trips view and selection', () => {
    const search = writeUrlState('', { view: 'rack', select: 'compute-tray.7/rubin-gpu.2' });
    expect(search).toBe('?select=compute-tray.7/rubin-gpu.2');
    expect(readUrlState(search, model)).toEqual({ view: 'rack', select: 'compute-tray.7/rubin-gpu.2' });
  });

  it('falls back to defaults for unknown values', () => {
    expect(readUrlState('?view=moon&select=compute-tray.99', model)).toEqual({ view: 'rack', select: '' });
  });

  it('keeps unrelated query parameters', () => {
    expect(writeUrlState('?utm=x', { view: 'rack', select: 'power-shelf.2' })).toBe('?utm=x&select=power-shelf.2');
    expect(writeUrlState('?select=power-shelf.2', { view: 'rack', select: '' })).toBe('');
  });
});
