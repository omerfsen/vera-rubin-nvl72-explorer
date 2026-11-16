// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import display from '../data/display.json';
import { model, topology } from '../src/data';
import { createModel } from '../src/data/model';
import type { Topology } from '../src/data/types';
import { rackTotals } from '../src/data/totals';
import { RackTotals } from '../src/components/RackTotals';
import { SidePanel } from '../src/components/SidePanel';
import { RackList } from '../src/components/RackList';
import { useExplorer } from '../src/state/store';

afterEach(() => {
  cleanup();
  useExplorer.setState({ selected: '', lang: 'en' });
});

const types = display.rackTotals.types;

describe('rack totals', () => {
  it('lists every component of the chosen types, in type order, never the rack', () => {
    const rows = rackTotals(model, types);
    const expected = topology.components.filter((c) => c.parent !== null && types.includes(c.type));
    expect(rows.map((r) => r.component.id).sort()).toEqual(expected.map((c) => c.id).sort());
    const order = rows.map((r) => types.indexOf(r.component.type));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(rows.some((r) => r.component.type === 'rack')).toBe(false);
  });

  it('only charts types the data uses', () => {
    const used = new Set(topology.components.map((c) => c.type));
    for (const t of types) expect(used.has(t as never), t).toBe(true);
  });

  it('computes each total from the counts up the parent chain', () => {
    for (const r of rackTotals(model, types)) {
      let expected: number | null = 1;
      for (const id of [...model.ancestorsOf(r.component.id), r.component.id]) {
        const n = model.getComponent(id)!.count;
        expected = expected === null || n === null ? null : expected * n;
      }
      expect(r.total, r.component.id).toBe(expected);
    }
  });

  it('keeps a null count as null and marks assumed counts', () => {
    const copy = structuredClone(topology) as Topology;
    const tray = copy.components.find((c) => c.parent === 'rack' && c.count !== null && types.includes(c.type))!;
    const child = copy.components.find((c) => c.parent === tray.id && types.includes(c.type))!;
    tray.assumed = true;
    tray.note = 'test note';
    child.count = null;
    const rows = rackTotals(createModel(copy), types);
    const trayRow = rows.find((r) => r.component.id === tray.id)!;
    const childRow = rows.find((r) => r.component.id === child.id)!;
    expect(trayRow.assumed).toBe(true);
    expect(trayRow.assumedBy?.id).toBe(tray.id);
    expect(childRow.total).toBeNull();
    expect(childRow.assumed).toBe(true);
  });
});

describe('rack totals chart', () => {
  it('renders one row per total with its number, "not stated" and a source link', () => {
    render(<RackTotals />);
    const rows = rackTotals(model, types);
    const table = screen.getByRole('table');
    const bodyRows = within(table).getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(rows.length);
    rows.forEach((r, i) => {
      const row = bodyRows[i]!;
      expect(within(row).getByRole('rowheader').textContent).toBe(r.component.name);
      const cells = within(row).getAllByRole('cell');
      expect(cells[0]!.textContent).toContain(r.total === null ? 'not stated' : String(r.total));
      const link = within(row).getByRole('link') as HTMLAnchorElement;
      expect(link.href).toBe(r.component.source.url);
      expect(link.getAttribute('aria-label')).toContain(r.component.source.section);
    });
    expect(rows.some((r) => r.total === null)).toBe(true);
  });

  it('selects a component type when its row is clicked', () => {
    render(<RackTotals />);
    const gpu = rackTotals(model, types).find((r) => r.component.type === 'gpu')!;
    fireEvent.click(screen.getByRole('button', { name: gpu.component.name }));
    expect(useExplorer.getState().selected).toBe(model.pathForComponent(gpu.component.id));
  });

  it('shows on the rack panel only, and in the list only when asked', () => {
    const { unmount } = render(<SidePanel />);
    expect(screen.getByRole('heading', { name: 'How many in the rack' })).toBeTruthy();
    unmount();
    render(<SidePanel totals={false} />);
    expect(screen.queryByRole('heading', { name: 'How many in the rack' })).toBeNull();
    cleanup();
    useExplorer.setState({ selected: 'compute-tray.7' });
    render(<SidePanel />);
    expect(screen.queryByRole('heading', { name: 'How many in the rack' })).toBeNull();
    cleanup();
    useExplorer.setState({ selected: '' });
    render(<RackList totals />);
    expect(screen.getByRole('heading', { name: 'How many in the rack' })).toBeTruthy();
  });

  it('is translated', () => {
    useExplorer.setState({ lang: 'tr' });
    render(<RackTotals />);
    expect(screen.getByRole('heading', { name: 'Kabinde kaç tane var' })).toBeTruthy();
  });
});
