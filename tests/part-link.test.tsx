// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CopyPartLink } from '../src/components/CopyPartLink';
import { copyText } from '../src/components/clipboard';
import { partUrl } from '../src/state/url';
import { useExplorer } from '../src/state/store';

const BASE = 'https://example.net/';

describe('partUrl', () => {
  it('keeps only the selection', () => {
    expect(partUrl(BASE, { view: 'rack', select: 'compute-tray.7' })).toBe('https://example.net/?select=compute-tray.7');
  });

  it('keeps the view when it is not the rack, and the language when it is not English', () => {
    expect(partUrl(BASE, { view: 'tray', select: 'compute-tray.7/rubin-gpu.2', lang: 'tr' })).toBe(
      'https://example.net/?view=tray&select=compute-tray.7/rubin-gpu.2&lang=tr',
    );
    expect(partUrl(BASE, { view: 'rear', select: 'power-shelf.2', lang: 'en' })).toBe('https://example.net/?view=rear&select=power-shelf.2');
  });

  it('leaves out quiz, comparison, walkthrough, network, list and foreign parameters from the current address', () => {
    // partUrl takes no query at all, so nothing from the current address can leak in.
    const url = new URL(partUrl(BASE, { view: 'rack', select: 'power-shelf.2', lang: 'zh' }));
    expect([...url.searchParams.keys()].sort()).toEqual(['lang', 'select']);
  });
});

describe('copyText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is false without a clipboard API', async () => {
    vi.stubGlobal('navigator', {});
    expect(await copyText('x')).toBe(false);
  });

  it('is false when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
    expect(await copyText('x')).toBe(false);
  });
});

describe('Copy link button', () => {
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    window.history.replaceState(null, '', '/?select=compute-tray.7&quiz=123&cmp=power-shelf.2&net=ipminet&list=1&proc=x&step=2');
    useExplorer.setState({ selected: 'compute-tray.7', view: 'rack', lang: 'en' });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    useExplorer.setState({ selected: '' });
    window.history.replaceState(null, '', '/');
  });

  it('is hidden at the rack itself', () => {
    useExplorer.setState({ selected: '' });
    render(<CopyPartLink name="rack" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('copies a clean link and says so for two seconds', async () => {
    vi.useFakeTimers();
    render(<CopyPartLink name="Compute tray 7" />);
    const button = screen.getByRole('button', { name: 'Copy link to Compute tray 7' });
    await act(async () => fireEvent.click(button));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?select=compute-tray.7`);
    expect(screen.getByRole('status').textContent).toBe('Link copied.');
    act(() => vi.advanceTimersByTime(2100));
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('shows the link selected for copying by hand when the clipboard fails', async () => {
    writeText.mockImplementation(() => Promise.reject(new Error('not allowed')));
    render(<CopyPartLink name="Compute tray 7" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link to Compute tray 7' })));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe(`${window.location.origin}/?select=compute-tray.7`);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
