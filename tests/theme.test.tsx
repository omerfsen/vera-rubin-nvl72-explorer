// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import display from '../data/display.json';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { syncTheme, useExplorer } from '../src/state/store';
import { THEME_STORAGE_KEY, resolveTheme, storedThemePref } from '../src/theme';

/** A controllable prefers-color-scheme media query. */
function fakeMedia(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  vi.stubGlobal('matchMedia', () => query);
  window.matchMedia = (() => query) as unknown as typeof window.matchMedia;
  return {
    set(next: boolean) {
      query.matches = next;
      listeners.forEach((l) => l());
    },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  useExplorer.setState({ themePref: 'system', theme: 'dark' });
  delete document.documentElement.dataset.theme;
});

describe('theme', () => {
  it('resolves System from the OS and dark when it cannot tell', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', null)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('the switcher sets data-theme and color-scheme and remembers the choice', () => {
    fakeMedia(true);
    const stop = syncTheme();
    render(<ThemeSwitcher />);
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(screen.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(storedThemePref()).toBe('light');
    fireEvent.click(screen.getByRole('button', { name: 'System' }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('dark');
    stop();
  });

  it('System follows the OS live; an explicit choice does not', () => {
    const media = fakeMedia(true);
    const stop = syncTheme();
    useExplorer.getState().setThemePref('system');
    media.set(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    media.set(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    useExplorer.getState().setThemePref('light');
    media.set(true);
    expect(document.documentElement.dataset.theme).toBe('light');
    stop();
  });

  it('blocked storage falls back to System', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(storedThemePref()).toBe('system');
    vi.restoreAllMocks();
  });

  it('display.json has the same scene colours for both themes', () => {
    expect(Object.keys(display.colors.scene.light).sort()).toEqual(Object.keys(display.colors.scene.dark).sort());
    expect(display.colors.scene.light.background).not.toBe(display.colors.scene.dark.background);
  });
});
