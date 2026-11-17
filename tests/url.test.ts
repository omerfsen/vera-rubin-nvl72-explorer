import { describe, expect, it } from 'vitest';
import { model } from '../src/data';
import { TOUR_STEPS } from '../src/data/tour';
import { embedUrl, readUrlState, writeUrlState } from '../src/state/url';

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

  it('builds an embed link without the tour step', () => {
    expect(embedUrl('https://x.test/')).toBe('https://x.test/?embed=1');
    expect(embedUrl('https://x.test/?view=tray&select=compute-tray.1&tour=3')).toBe('https://x.test/?view=tray&select=compute-tray.1&embed=1');
    expect(embedUrl('https://x.test/?tour=3')).toBe('https://x.test/?embed=1');
    expect(embedUrl('https://x.test/?utm=a%20b&tour=3&list=1#top')).toBe('https://x.test/?utm=a%20b&list=1&embed=1#top');
    expect(embedUrl('https://x.test/?embed=1&tour=2')).toBe('https://x.test/?embed=1');
  });

  it('round-trips a tour step as a 1-based number', () => {
    const last = TOUR_STEPS.length - 1;
    expect(writeUrlState('', { ...state(''), tour: 0 })).toBe('?tour=1');
    expect(writeUrlState('?tour=9&x=1', { ...state(''), tour: 2 })).toBe('?x=1&tour=3');
    expect(writeUrlState('', { ...state(''), tour: last })).toBe(`?tour=${last + 1}`);
    expect(readUrlState('?tour=3', model)).toEqual({ ...state(''), tour: 2 });
    expect(readUrlState(`?tour=${last + 1}`, model).tour).toBe(last);
    for (let i = 0; i <= last; i++) expect(readUrlState(writeUrlState('', { ...state(''), tour: i }), model).tour).toBe(i);
  });

  it('drops the tour key when the tour is off or the step is not one it has', () => {
    expect(writeUrlState('?tour=3', state(''))).toBe('');
    for (const tour of [-1, 1.5, NaN, TOUR_STEPS.length]) expect(writeUrlState('?tour=3', { ...state(''), tour })).toBe('');
  });

  it('ignores a tour value that is not a step number, and any tour in an embed', () => {
    for (const raw of ['', '0', '-1', '1.5', '03', '1e0', ' 2', 'abc', '%00', String(TOUR_STEPS.length + 1), '9999999999'])
      expect(readUrlState(`?tour=${raw}`, model).tour, raw).toBeUndefined();
    expect(readUrlState('?tour=3&embed=1', model).tour).toBeUndefined();
    expect(readUrlState('?tour=1&tour=3', model).tour).toBe(0);
  });
});

describe('hidden connection kinds (lk)', () => {
  it('round-trips, drops unknown kinds and leaves an empty list out', () => {
    const s = { ...state('compute-tray.3'), lk: ['pcie', 'coolant'] };
    const search = writeUrlState('', s);
    expect(search).toBe('?select=compute-tray.3&lk=pcie,coolant');
    expect(readUrlState(search, model).lk).toEqual(['pcie', 'coolant']);
    expect(readUrlState('?lk=moon,power,power', model).lk).toEqual(['power']);
    expect(readUrlState('?lk=moon', model)).not.toHaveProperty('lk');
    expect(writeUrlState('', { ...state(''), lk: [] })).toBe('');
  });
});
