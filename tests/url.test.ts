import { describe, expect, it } from 'vitest';
import { model } from '../src/data';
import { readUrlState, writeUrlState } from '../src/state/url';

const state = (select: string, list = false) => ({ view: 'rack' as const, select, list, net: '', proc: '', step: 0, page: '', embed: false });

describe('URL state', () => {
  it('round-trips view, selection and the list pane', () => {
    const search = writeUrlState('', state('compute-tray.7/rubin-gpu.2', true));
    expect(search).toBe('?select=compute-tray.7/rubin-gpu.2&list=1');
    expect(readUrlState(search, model)).toEqual(state('compute-tray.7/rubin-gpu.2', true));
  });

  it('falls back to defaults for unknown values', () => {
    expect(readUrlState('?view=moon&select=compute-tray.99&list=yes', model)).toEqual(state(''));
  });

  it('copies other query parameters through byte for byte', () => {
    expect(writeUrlState('?utm=x', state('power-shelf.2'))).toBe('?utm=x&select=power-shelf.2');
    expect(writeUrlState('?debug', state('power-shelf.2'))).toBe('?debug&select=power-shelf.2');
    expect(writeUrlState('?q=a%20b&next=%2Ffoo', state(''))).toBe('?q=a%20b&next=%2Ffoo');
    expect(writeUrlState('?select=power-shelf.2', state(''))).toBe('');
    expect(writeUrlState('?select=a&select=b&x=1', state('switch-tray.1'))).toBe('?x=1&select=switch-tray.1');
  });
});
