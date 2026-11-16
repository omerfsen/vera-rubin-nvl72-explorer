// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { model } from '../src/data';
import { quickStarts } from '../src/components/EmptyPrompt';
import { SidePanel } from '../src/components/SidePanel';
import { useExplorer } from '../src/state/store';

afterEach(() => {
  cleanup();
  useExplorer.setState({ selected: '', lang: 'en', quiz: null, compare: '', procedure: '', step: 0 });
});

const prompt = () => screen.queryByRole('region', { name: 'Getting started' });

describe('empty panel prompt', () => {
  it('shows at the rack root, above the rack summary and totals chart', () => {
    render(<SidePanel />);
    const region = prompt()!;
    expect(region).toBeTruthy();
    expect(region.textContent).toContain('Select a part in the rack, or pick one below');
    expect(region.textContent).toContain('↑ ↓');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('DGX Vera Rubin NVL72 rack');
    expect(screen.getByRole('heading', { name: 'How many in the rack' })).toBeTruthy();
    // The prompt comes first.
    const title = screen.getByRole('heading', { level: 2 });
    expect(region.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers one start per rack unit type, from the data, each selecting that type\'s first unit', () => {
    const types = [...new Set(model.rackUnits.map((u) => u.componentId))];
    const starts = quickStarts();
    expect(starts.length).toBeGreaterThanOrEqual(2);
    expect(starts.length).toBeLessThanOrEqual(4);
    expect(starts.map((s) => s.componentId)).toEqual(types.slice(0, 4));
    for (const s of starts) {
      const lowest = Math.min(...model.rackUnits.filter((u) => u.componentId === s.componentId).map((u) => u.index));
      expect(s.index).toBe(lowest);
      expect(model.rackUnitByKey.get(s.key)?.componentId).toBe(s.componentId);
    }

    render(<SidePanel />);
    const buttons = within(prompt()!).getAllByRole('button');
    expect(buttons).toHaveLength(starts.length);
    starts.forEach((s, i) => {
      cleanup();
      useExplorer.setState({ selected: '' });
      render(<SidePanel />);
      fireEvent.click(within(prompt()!).getAllByRole('button')[i]!);
      expect(useExplorer.getState().selected).toBe(s.key);
    });
  });

  it('is gone once something is selected', () => {
    useExplorer.setState({ selected: quickStarts()[0]!.key });
    render(<SidePanel />);
    expect(prompt()).toBeNull();
  });

  it('is hidden during a quiz, a comparison and a walkthrough', () => {
    useExplorer.getState().startQuiz(1);
    expect(useExplorer.getState().selected).toBe('');
    render(<SidePanel />);
    expect(prompt()).toBeNull();
    cleanup();
    useExplorer.setState({ quiz: null, selected: '', compare: quickStarts()[0]!.key });
    render(<SidePanel />);
    expect(prompt()).toBeNull();
    cleanup();
    const proc = model.topology.procedures![0]!;
    useExplorer.setState({ compare: '', selected: '', procedure: proc.id, step: 0 });
    render(<SidePanel />);
    expect(prompt()).toBeNull();
  });

  it('does not mention the 3D rack in the list-only fallback', () => {
    render(<SidePanel totals={false} webgl={false} />);
    const text = prompt()!.textContent!;
    expect(text).toContain('Select a part in the list, or pick one below');
    expect(text).not.toContain('3D');
    expect(text).not.toContain('in the rack');
  });

  it('is translated', () => {
    useExplorer.setState({ lang: 'tr' });
    render(<SidePanel />);
    expect(screen.getByRole('region', { name: 'Başlarken' })).toBeTruthy();
  });
});
