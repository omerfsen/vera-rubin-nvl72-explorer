// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { model } from '../src/data';
import { buildComparison, compareSide } from '../src/data/compare';
import { readUrlState, writeUrlState } from '../src/state/url';
import { syncUrl, useExplorer } from '../src/state/store';
import { SidePanel } from '../src/components/SidePanel';

const base = { view: 'rack' as const, list: false, net: '', proc: '', step: 0, page: '', embed: false };

describe('comparison rows', () => {
  it('lines up specs by label and flags the ones that differ', () => {
    const cmp = buildComparison(model, 'compute-tray.3', 'switch-tray.1')!;
    expect(cmp.left.component.id).toBe('compute-tray');
    expect(cmp.right.component.id).toBe('switch-tray');
    const height = cmp.specs.find((r) => r.label === 'Height')!;
    expect(height.left?.value).toBe(1);
    expect(height.right?.value).toBe(1);
    expect(height.differs).toBe(false);
    const cooling = cmp.specs.find((r) => r.label === 'Cooling')!;
    expect(cooling.differs).toBe(true);
    // A spec only one side has is a difference, with the other side empty.
    const asics = cmp.specs.find((r) => r.label === 'NVSwitch ASICs')!;
    expect(asics.left).toBeUndefined();
    expect(asics.differs).toBe(true);
    // Left labels come first, in the left part's own order.
    expect(cmp.specs.slice(0, cmp.left.component.specs.length).map((r) => r.label)).toEqual(
      cmp.left.component.specs.map((s) => s.label),
    );
    // Every spec of both sides is listed once.
    const labels = new Set([...cmp.left.component.specs, ...cmp.right.component.specs].map((s) => s.label));
    expect(cmp.specs.length).toBe(labels.size);
  });

  it('takes counts and networks from the model', () => {
    const cmp = buildComparison(model, 'compute-tray/rubin-gpu', 'compute-tray/vera-cpu.1')!;
    expect(cmp.left.totalPerRack).toBe(model.totalPerRack('rubin-gpu'));
    expect(cmp.right.totalPerRack).toBe(model.totalPerRack('vera-cpu'));
    const ids = new Set([...model.networksWithin('rubin-gpu'), ...model.networksWithin('vera-cpu')].map((n) => n.id));
    expect(cmp.networks.map((n) => n.network.id).sort()).toEqual([...ids].sort());
    for (const n of cmp.networks) {
      expect(n.left).toBe(model.networksWithin('rubin-gpu').some((x) => x.id === n.network.id));
      expect(n.right).toBe(model.networksWithin('vera-cpu').some((x) => x.id === n.network.id));
    }
  });

  it('rejects paths that name nothing', () => {
    expect(compareSide(model, 'compute-tray.99')).toBeNull();
    expect(buildComparison(model, 'bogus', 'switch-tray.1')).toBeNull();
  });
});

describe('compare in the URL', () => {
  it('round-trips cmp next to the selection', () => {
    const state = { ...base, select: 'switch-tray.1', cmp: 'compute-tray.3/rubin-gpu.2' };
    const search = writeUrlState('', state);
    expect(search).toBe('?select=switch-tray.1&cmp=compute-tray.3/rubin-gpu.2');
    expect(readUrlState(search, model)).toEqual(state);
  });

  it('drops an invalid cmp', () => {
    expect(readUrlState('?select=switch-tray.1&cmp=compute-tray.99', model).cmp).toBeUndefined();
    expect(readUrlState('?cmp=../etc', model).cmp).toBeUndefined();
  });
});

describe('compare in the store', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));
  afterEach(() => {
    cleanup();
    useExplorer.setState({ selected: '', compare: '', view: 'rack' });
  });

  it('pins, swaps, clears and stops, and keeps the URL in step', () => {
    useExplorer.setState({ selected: 'compute-tray.3', compare: '' });
    const stop = syncUrl();
    const s = () => useExplorer.getState();
    s().startCompare();
    expect(s().compare).toBe('compute-tray.3');
    s().select('switch-tray.1');
    expect(window.location.search).toBe('?select=switch-tray.1&cmp=compute-tray.3');
    s().swapCompare();
    expect([s().compare, s().selected]).toEqual(['switch-tray.1', 'compute-tray.3']);
    s().clearCompare();
    expect([s().compare, s().selected]).toEqual(['switch-tray.1', 'switch-tray.1']);
    s().stopCompare();
    expect(s().compare).toBe('');
    expect(window.location.search).toBe('?select=switch-tray.1');
    stop();
  });

  it('does not pin the rack or an invalid path', () => {
    useExplorer.setState({ selected: '', compare: '' });
    useExplorer.getState().startCompare();
    useExplorer.getState().startCompare('nope.1');
    expect(useExplorer.getState().compare).toBe('');
  });

  it('shows two columns with differences marked, from the side panel', () => {
    useExplorer.setState({ selected: 'compute-tray.3', compare: '' });
    render(<SidePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByText(/is pinned/)).toBeTruthy();
    act(() => useExplorer.getState().select('switch-tray.1'));
    const name = model.getComponent('switch-tray')!.name;
    const region = screen.getByRole('region', { name: `Comparison of Compute tray 3 and ${name} 1` });
    const table = within(region).getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Compute tray 3' })).toBeTruthy();
    const cooling = within(table).getByRole('rowheader', { name: /^Cooling/ });
    expect(cooling.closest('tr')!.className).toBe('differs');
    const height = within(table).getByRole('rowheader', { name: 'Height' });
    expect(height.closest('tr')!.className).toBe('');
    fireEvent.click(within(region).getByRole('button', { name: 'Stop comparing' }));
    expect(useExplorer.getState().compare).toBe('');
  });
});
