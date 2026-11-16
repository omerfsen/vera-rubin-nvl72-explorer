// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { model } from '../src/data';
import { i18nFor, LANGS } from '../src/i18n';
import { THEME_PREFS } from '../src/theme';
import { useExplorer } from '../src/state/store';
import { matchScore, paletteActions, paletteResults } from '../src/components/palette';
import { CommandPalette } from '../src/components/CommandPalette';

const en = i18nFor('en');
const reset = {
  selected: '',
  compare: '',
  view: 'rack' as const,
  network: '',
  page: '',
  procedure: '',
  step: 0,
  listOpen: false,
  panelOpen: true,
  embed: false,
  lang: 'en' as const,
  quiz: null,
};

afterEach(() => {
  cleanup();
  useExplorer.setState(reset);
});

const ids = (webgl = true) => paletteActions(model, useExplorer.getState(), en, webgl).map((a) => a.id);

describe('palette actions', () => {
  it('come from the data and the store', () => {
    useExplorer.setState(reset);
    const all = ids();
    for (const n of model.topology.networks) expect(all).toContain(`network:${n.id}`);
    for (const p of model.topology.procedures ?? []) expect(all).toContain(`procedure:${p.id}`);
    for (const l of LANGS) expect(all).toContain(`lang:${l}`);
    for (const p of THEME_PREFS) expect(all).toContain(`theme:${p}`);
    expect(all).toEqual(expect.arrayContaining(['view:front', 'view:rear', 'list', 'page:sources', 'quiz', 'details']));
    // Only what applies now: nothing to clear, stop or compare yet.
    expect(all).not.toContain('network:clear');
    expect(all).not.toContain('compare:start');
    expect(all).not.toContain('procedure:stop');
    expect(new Set(all).size).toBe(all.length);
  });

  it('follow the state: clear network, compare, stop, back from Sources', () => {
    const net = model.topology.networks[0]!.id;
    const proc = (model.topology.procedures ?? [])[0]!.id;
    useExplorer.setState({ ...reset, network: net, selected: 'compute-tray.3', procedure: proc, page: 'sources' });
    expect(ids()).toEqual(expect.arrayContaining(['network:clear', 'compare:start', 'procedure:stop', 'page:close']));
    useExplorer.setState({ compare: 'switch-tray.1' });
    expect(ids()).toContain('compare:stop');
    expect(ids()).not.toContain('compare:start');
  });

  it('leave out the 3D-only actions without WebGL', () => {
    useExplorer.setState(reset);
    const all = ids(false);
    for (const id of ['view:front', 'view:rear', 'list', 'details']) expect(all).not.toContain(id);
    expect(all).toContain(`network:${model.topology.networks[0]!.id}`);
  });

  it('are labelled in the chosen language and still match the English', () => {
    useExplorer.setState(reset);
    const tr = i18nFor('tr');
    const rear = paletteActions(model, useExplorer.getState(), tr, true).find((a) => a.id === 'view:rear')!;
    expect(rear.label).toBe(tr.t('palette.rear'));
    expect(matchScore('rear', rear)).not.toBeNull();
  });
});

describe('palette ranking', () => {
  it('ranks label prefix over word start over substring', () => {
    const item = (label: string) => ({ label, detail: '', keywords: '' });
    expect(matchScore('show', item('Show the rear'))).toBeLessThan(matchScore('rear', item('Show the rear'))!);
    expect(matchScore('rear', item('Show the rear'))).toBeLessThan(matchScore('ear', item('Show the rear'))!);
    expect(matchScore('zzz', item('Show the rear'))).toBeNull();
  });

  it('puts a network action first, and finds parts with the search box logic', () => {
    useExplorer.setState(reset);
    const actions = paletteActions(model, useExplorer.getState(), en, true);
    const net = model.topology.networks.find((n) => n.id === 'ipminet')!;
    expect(paletteResults(model, net.name, actions, en)[0]!.id).toBe(`network:${net.id}`);
    const parts = paletteResults(model, 'mlx5_4', actions, en);
    expect(parts[0]!.kind).toBe('part');
    expect(parts[0]!.id.startsWith('part:compute-tray/ct-port-cx9-osfp.2|')).toBe(true);
    // No query: every action, no parts.
    expect(paletteResults(model, '', actions, en)).toEqual(actions);
  });
});

describe('CommandPalette', () => {
  const openWithKeys = () => fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

  it('opens on Ctrl+K, moves with the arrows and runs the action on Enter', () => {
    useExplorer.setState(reset);
    render(<CommandPalette webgl />);
    act(() => openWithKeys());
    const dialog = screen.getByRole('dialog', { name: 'Command palette' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const input = screen.getByRole('combobox', { name: 'Command or part' });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'ipminet' } });
    const options = screen.getAllByRole('option');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]!.id);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]!.id);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useExplorer.getState().network).toBe('ipminet');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('selects a part on Enter', () => {
    useExplorer.setState(reset);
    render(<CommandPalette webgl />);
    act(() => openWithKeys());
    const input = screen.getByRole('combobox', { name: 'Command or part' });
    fireEvent.change(input, { target: { value: 'mlx5_4' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useExplorer.getState().selected).toBe('compute-tray/ct-port-cx9-osfp.2');
  });

  it('closes on Escape, returns focus, and does not go up a level', () => {
    useExplorer.setState({ ...reset, selected: 'compute-tray.3' });
    render(
      <>
        <button type="button">before</button>
        <CommandPalette webgl />
      </>,
    );
    const before = screen.getByRole('button', { name: 'before' });
    before.focus();
    act(() => openWithKeys());
    const input = screen.getByRole('combobox', { name: 'Command or part' });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(before);
    expect(useExplorer.getState().selected).toBe('compute-tray.3');
  });

  it('keeps Tab inside the dialog', () => {
    useExplorer.setState(reset);
    render(<CommandPalette webgl />);
    act(() => openWithKeys());
    const input = screen.getByRole('combobox', { name: 'Command or part' });
    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(close);
  });

  it('opens from its button, and "/" only outside text fields', () => {
    useExplorer.setState(reset);
    render(
      <>
        <input aria-label="other" />
        <CommandPalette webgl />
      </>,
    );
    act(() => fireEvent.keyDown(screen.getByRole('textbox', { name: 'other' }), { key: '/' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => fireEvent.keyDown(document.body, { key: '/' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Command or part' }), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /Commands/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('is not shown in an embed', () => {
    useExplorer.setState({ ...reset, embed: true });
    render(<CommandPalette webgl />);
    act(() => openWithKeys());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /Commands/ })).toBeNull();
  });
});
