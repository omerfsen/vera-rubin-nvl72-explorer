import { describe, expect, it } from 'vitest';
import { model } from '../src/data';
import { trayLinkKinds, visibleLinks } from '../src/data/linkFilter';

describe('connection kind filter helpers', () => {
  it('lists every kind the tray layouts draw, once', () => {
    const kinds = trayLinkKinds(model);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const k of ['pcie', 'c2c', 'clink', 'nvlink', 'coolant', 'power']) expect(kinds).toContain(k);
  });

  it('keeps the layout index of every link that stays visible', () => {
    const links = model.trayLayout('compute-tray')!.links!;
    const all = visibleLinks(links, []);
    expect(all.map((v) => v.index)).toEqual(links.map((_, i) => i));
    const noPcie = visibleLinks(links, ['pcie']);
    expect(noPcie.every(({ link }) => link.kind !== 'pcie')).toBe(true);
    for (const { link, index } of noPcie) expect(links[index]).toBe(link);
    expect(visibleLinks(links, trayLinkKinds(model))).toEqual([]);
  });
});
