// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { model } from '../src/data';
import { filterNetworks, filterTypes, filterUnits, parseFilterList, toggleIn, unitTypesByNetwork } from '../src/data/listFilter';
import { readUrlState, writeUrlState } from '../src/state/url';
import { RackList } from '../src/components/RackList';
import { useExplorer } from '../src/state/store';

afterEach(() => {
  cleanup();
  useExplorer.setState({ selected: '', lang: 'en', listFilter: { types: [], nets: [] }, network: '' });
});

const total = model.rackUnits.length;
const byType = (id: string) => model.rackUnits.filter((u) => u.componentId === id).length;

describe('list filter logic', () => {
  it('offers every rack unit type once, top to bottom', () => {
    const types = filterTypes(model);
    expect(new Set(types)).toEqual(new Set(model.rackUnits.map((u) => u.componentId)));
    expect(types.length).toBe(new Set(types).size);
    expect(types[0]).toBe(model.rackUnits[0]!.componentId);
  });

  it('offers only networks that have a rack unit on them, matching the overlay', () => {
    const nets = filterNetworks(model);
    for (const n of model.topology.networks) {
      const unitTypes = model.networkMembers(n.id).unitTypes;
      expect(nets.includes(n.id), n.id).toBe(unitTypes.size > 0);
    }
    expect(nets.length).toBeGreaterThan(0);
  });

  it('with no chips shows every unit', () => {
    expect(filterUnits(model, { types: [], nets: [] })).toHaveLength(total);
  });

  it('ORs chips within a row', () => {
    const [a, b] = filterTypes(model);
    expect(filterUnits(model, { types: [a!], nets: [] })).toHaveLength(byType(a!));
    expect(filterUnits(model, { types: [a!, b!], nets: [] })).toHaveLength(byType(a!) + byType(b!));
    const byNet = unitTypesByNetwork(model);
    const [n1, n2] = filterNetworks(model);
    const union = new Set([...byNet.get(n1!)!, ...byNet.get(n2!)!]);
    expect(filterUnits(model, { types: [], nets: [n1!, n2!] })).toHaveLength(
      model.rackUnits.filter((u) => union.has(u.componentId)).length,
    );
  });

  it('ANDs the two rows', () => {
    const byNet = unitTypesByNetwork(model);
    for (const net of filterNetworks(model)) {
      for (const type of filterTypes(model)) {
        const got = filterUnits(model, { types: [type], nets: [net] });
        expect(got.length, `${type} on ${net}`).toBe(byNet.get(net)!.has(type) ? byType(type) : 0);
      }
    }
  });

  it('a unit matches a network through a part inside it', () => {
    // Members of a network are ports and parts; the unit that holds them matches.
    for (const net of filterNetworks(model)) {
      const { members } = model.networkMembers(net);
      for (const u of filterUnits(model, { types: [], nets: [net] })) {
        const holds = [...members.keys()].some((m) => m === u.componentId || model.ancestorsOf(m).includes(u.componentId));
        expect(holds, `${u.key} on ${net}`).toBe(true);
      }
    }
  });

  it('toggles a value in canonical order', () => {
    expect(toggleIn([], 'b', ['a', 'b', 'c'])).toEqual(['b']);
    expect(toggleIn(['c'], 'a', ['a', 'b', 'c'])).toEqual(['a', 'c']);
    expect(toggleIn(['a', 'c'], 'a', ['a', 'b', 'c'])).toEqual(['c']);
  });

  it('drops unknown and repeated values from a URL list', () => {
    expect(parseFilterList('c,x,a,a,', ['a', 'b', 'c'])).toEqual(['a', 'c']);
    expect(parseFilterList(null, ['a'])).toEqual([]);
  });
});

describe('list filter in the URL', () => {
  const base = { view: 'rack' as const, select: '', list: true };

  it('round-trips types and networks', () => {
    const ft = filterTypes(model).slice(0, 2);
    const fn = filterNetworks(model).slice(0, 1);
    const search = writeUrlState('', { ...base, ft, fn });
    expect(search).toBe(`?list=1&ft=${ft.join(',')}&fn=${fn.join(',')}`);
    const read = readUrlState(search, model);
    expect(read.ft).toEqual(ft);
    expect(read.fn).toEqual(fn);
  });

  it('drops invalid values and leaves empty filters out', () => {
    const [type] = filterTypes(model);
    const read = readUrlState(`?list=1&ft=moon,${type},<script>&fn=nonet`, model);
    expect(read.ft).toEqual([type]);
    expect(read.fn).toBeUndefined();
    expect(writeUrlState('?ft=x&fn=y&keep=1', { ...base, ft: [], fn: [] })).toBe('?keep=1&list=1');
  });
});

describe('list filter chips', () => {
  it('filters the list, counts, clears and leaves the overlay alone', () => {
    render(<RackList />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe(`${total} of ${total} units`);
    const types = screen.getByRole('group', { name: 'Filter by unit type' });
    const [first] = filterTypes(model);
    const chip = within(types).getByRole('button', { name: model.getComponent(first!)!.name });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(status.textContent).toBe(`${byType(first!)} of ${total} units`);
    const nets = screen.getByRole('group', { name: 'Filter by network' });
    const netChips = within(nets).getAllByRole('button');
    expect(netChips).toHaveLength(filterNetworks(model).length);
    fireEvent.click(netChips[0]!);
    expect(useExplorer.getState().network).toBe('');
    // A type that is on no network chosen gives the empty message.
    const byNet = unitTypesByNetwork(model);
    const missing = filterTypes(model).find((t) => !byNet.get(filterNetworks(model)[0]!)!.has(t));
    if (missing) {
      fireEvent.click(chip);
      fireEvent.click(within(types).getByRole('button', { name: model.getComponent(missing)!.name }));
      expect(status.textContent).toBe(`0 of ${total} units`);
      expect(screen.getByText(/No units match these filters/)).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(status.textContent).toBe(`${total} of ${total} units`);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });
});
