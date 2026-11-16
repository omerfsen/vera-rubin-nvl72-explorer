// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { model } from '../src/data';
import { readUrlState } from '../src/state/url';
import { HINT_STORAGE_KEY, initialHintOpen, storeHintSeen, storedHintSeen } from '../src/state/firstVisit';
import { useExplorer } from '../src/state/store';
import { FirstVisitHint, HintButton } from '../src/components/FirstVisitHint';

const open = (search: string) => initialHintOpen(readUrlState(search, model));
const firstUnit = model.rackUnits.find((u) => model.trayLayout(u.componentId))!.key;

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useExplorer.setState({ hintOpen: false, selected: '', view: 'rack', network: '' });
});

describe('first-visit hint: when it shows', () => {
  it('shows on a plain first visit, also with only a language in the URL', () => {
    expect(open('')).toBe(true);
    expect(open('?lang=tr')).toBe(true);
  });

  it('stays hidden in an embed and on a link that already shows something', () => {
    expect(open('?embed=1')).toBe(false);
    const net = model.topology.networks[0]!.id;
    for (const search of [`?select=${firstUnit}`, '?view=rear', `?net=${net}`, '?quiz=12345', '?tour=1', `?cmp=${firstUnit}`, '?page=sources'])
      expect(open(search), search).toBe(false);
  });

  it('stays hidden once dismissed in this browser', () => {
    storeHintSeen();
    expect(window.localStorage.getItem(HINT_STORAGE_KEY)).toBe('seen');
    expect(storedHintSeen()).toBe(true);
    expect(open('')).toBe(false);
  });

  it('does not crash when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(storedHintSeen()).toBe(false);
    expect(() => storeHintSeen()).not.toThrow();
    useExplorer.setState({ hintOpen: true });
    render(<FirstVisitHint />);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(useExplorer.getState().hintOpen).toBe(false);
  });
});

describe('first-visit hint: the card', () => {
  it('is a region with a heading and three steps, and does not take focus', () => {
    useExplorer.setState({ hintOpen: true });
    render(<FirstVisitHint />);
    const region = screen.getByRole('region', { name: 'Quick tips' });
    expect(screen.getByRole('heading', { name: 'Quick tips' })).toBeTruthy();
    expect(region.querySelectorAll('li')).toHaveLength(3);
    expect(region.contains(document.activeElement)).toBe(false);
  });

  it('"Got it" closes it and remembers that', () => {
    useExplorer.setState({ hintOpen: true });
    render(<FirstVisitHint />);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('region', { name: 'Quick tips' })).toBeNull();
    expect(window.localStorage.getItem(HINT_STORAGE_KEY)).toBe('seen');
  });

  it('Escape inside it closes it without going up a level', () => {
    useExplorer.setState({ hintOpen: true, selected: firstUnit });
    render(<FirstVisitHint />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Got it' }), { key: 'Escape' });
    expect(useExplorer.getState().hintOpen).toBe(false);
    expect(useExplorer.getState().selected).toBe(firstUnit);
  });

  it('ticks off a selection and closes itself once a unit is opened', () => {
    useExplorer.setState({ hintOpen: true });
    render(<FirstVisitHint />);
    act(() => useExplorer.getState().select(firstUnit));
    expect(screen.getAllByText(/done/)).toHaveLength(1);
    expect(useExplorer.getState().hintOpen).toBe(true);
    act(() => useExplorer.getState().openTray());
    expect(useExplorer.getState().view).toBe('tray');
    expect(useExplorer.getState().hintOpen).toBe(false);
    expect(window.localStorage.getItem(HINT_STORAGE_KEY)).toBe('seen');
  });

  it('the "?" button brings it back and moves focus to it', async () => {
    storeHintSeen();
    render(
      <>
        <HintButton />
        <FirstVisitHint />
      </>,
    );
    const button = screen.getByRole('button', { name: 'Show tips' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    const region = screen.getByRole('region', { name: 'Quick tips' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(region));
    fireEvent.click(button);
    expect(screen.queryByRole('region', { name: 'Quick tips' })).toBeNull();
  });
});
