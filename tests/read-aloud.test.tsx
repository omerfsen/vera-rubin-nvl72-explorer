// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SidePanel } from '../src/components/SidePanel';
import { useExplorer } from '../src/state/store';
import { chunkText, panelText, pickVoice } from '../src/lib/speech';

type Voice = { lang: string; name: string; localService: boolean; default: boolean; voiceURI: string };
const voice = (lang: string, localService = true): Voice => ({ lang, name: lang, localService, default: false, voiceURI: lang });

class FakeUtterance {
  lang = '';
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}

let spoken: FakeUtterance[] = [];
const synth = {
  voices: [] as Voice[],
  speaking: false,
  pending: false,
  getVoices() {
    return this.voices;
  },
  speak: vi.fn((u: FakeUtterance) => {
    spoken.push(u);
    synth.speaking = true;
  }),
  cancel: vi.fn(() => {
    synth.speaking = false;
  }),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

beforeEach(() => {
  spoken = [];
  synth.speaking = false;
  synth.voices = [voice('en-US'), voice('tr-TR')];
  synth.speak.mockClear();
  synth.cancel.mockClear();
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  useExplorer.setState({ selected: 'compute-tray.3', compare: '', view: 'rack', lang: 'en' });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const playButton = () => screen.getByRole('button', { name: /^Read aloud: / });

describe('Read aloud', () => {
  it('says nothing until the button is pressed, then reads the panel in the page language', () => {
    render(<SidePanel />);
    expect(synth.speak).not.toHaveBeenCalled();
    fireEvent.click(playButton());
    const text = spoken.map((u) => u.text).join(' ');
    expect(text).toContain('Compute tray 3');
    expect(text).toMatch(/What it is/i);
    // Controls are not read.
    expect(text).not.toContain('Copy link');
    expect(text).not.toContain('Read aloud');
    expect(spoken.every((u) => u.lang === 'en-US')).toBe(true);
    expect(spoken.every((u) => u.text.length <= 130)).toBe(true);
    // Commands, sources and the document list are not read.
    expect(text).not.toMatch(/curl|redfish|https?:|Source:|PDF p\./);
  });

  it('stops on a second press, on a new part and on a new language', () => {
    render(<SidePanel />);
    fireEvent.click(playButton());
    const stopButton = screen.getByRole('button', { name: 'Stop reading' });
    synth.cancel.mockClear();
    fireEvent.click(stopButton);
    expect(synth.cancel).toHaveBeenCalled();
    expect(playButton()).toBeTruthy();

    fireEvent.click(playButton());
    synth.cancel.mockClear();
    act(() => useExplorer.getState().select('switch-tray.1'));
    expect(synth.cancel).toHaveBeenCalled();
    expect(playButton()).toBeTruthy();

    fireEvent.click(playButton());
    synth.cancel.mockClear();
    act(() => useExplorer.setState({ lang: 'tr' }));
    expect(synth.cancel).toHaveBeenCalled();
  });

  it('gives the button back when the reading ends, fails or never starts, and stops when the panel collapses', () => {
    vi.useFakeTimers();
    try {
      render(<SidePanel />);
      fireEvent.click(playButton());
      act(() => {
        spoken.forEach((u) => u.onstart?.());
        spoken.at(-1)!.onend?.();
      });
      expect(playButton()).toBeTruthy();

      fireEvent.click(playButton());
      act(() => spoken.at(-1)!.onerror?.({ error: 'synthesis-failed' }));
      expect(playButton()).toBeTruthy();

      // Nothing ever starts (no engine): the watchdog resets the button.
      synth.speak.mockImplementation((u: FakeUtterance) => spoken.push(u));
      fireEvent.click(playButton());
      expect(screen.getByRole('button', { name: 'Stop reading' })).toBeTruthy();
      act(() => vi.advanceTimersByTime(3100));
      expect(playButton()).toBeTruthy();
      synth.speak.mockImplementation((u: FakeUtterance) => {
        spoken.push(u);
        synth.speaking = true;
      });

      fireEvent.click(playButton());
      synth.cancel.mockClear();
      act(() => useExplorer.setState({ panelOpen: false }));
      expect(synth.cancel).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      useExplorer.setState({ panelOpen: true });
    }
  });

  it('does not cancel before speaking when nothing is playing', () => {
    render(<SidePanel />);
    fireEvent.click(playButton());
    expect(synth.cancel).not.toHaveBeenCalled();
  });

  it('still offers reading when the browser lists no voices yet (Android Chrome), by language only', () => {
    synth.voices = [];
    render(<SidePanel />);
    fireEvent.click(playButton());
    expect(spoken.length).toBeGreaterThan(0);
    expect(spoken.every((u) => u.lang === 'en-US' && u.voice === null)).toBe(true);
  });

  it('is hidden without browser speech or without a voice for the language', () => {
    synth.voices = [voice('tr-TR')];
    render(<SidePanel />);
    expect(screen.queryByRole('button', { name: /^Read aloud: / })).toBeNull();
    cleanup();
    vi.stubGlobal('speechSynthesis', undefined);
    render(<SidePanel />);
    expect(screen.queryByRole('button', { name: /^Read aloud: / })).toBeNull();
  });
});

describe('speech helpers', () => {
  it('picks an exact voice, then one of the same language, local first', () => {
    const list = [voice('en-GB', false), voice('en-GB'), voice('es-MX')] as unknown as SpeechSynthesisVoice[];
    expect(pickVoice(list, 'en')?.lang).toBe('en-GB');
    expect(pickVoice(list, 'en')?.localService).toBe(true);
    expect(pickVoice(list, 'es')?.lang).toBe('es-MX');
    expect(pickVoice(list, 'zh')).toBeNull();
  });

  it('splits long text at sentence ends and keeps every word', () => {
    const long = `${'word '.repeat(120)}end. Short one. 第一句。第二句！`;
    const chunks = chunkText(long, 130);
    expect(chunks.every((c) => c.length <= 130)).toBe(true);
    expect(chunks.join('').replace(/\s+/g, '')).toBe(long.replace(/\s+/g, ''));
  });

  it('keeps "Fig. 1", "e.g." and "2.3" inside one sentence, and gives CJK a smaller budget', () => {
    expect(chunkText('See Fig. 1 in 2.2 for e.g. the port. Next.')).toEqual(['See Fig. 1 in 2.2 for e.g. the port.', 'Next.']);
    const zh = '计算托盘'.repeat(30) + '。';
    expect(chunkText(zh).every((c) => c.length <= 52)).toBe(true);
    expect(chunkText('第一句。. 第二句。')).toEqual(['第一句。', '第二句。']);
  });

  it('prefers the system default voice, and mainland Mandarin for zh', () => {
    const list = [
      { ...voice('en-US'), name: 'Albert' },
      { ...voice('en-US'), name: 'Samantha', default: true },
      voice('zh-HK'),
      voice('zh-TW'),
      { ...voice('cmn-Hans-CN'.replace('cmn-Hans-', 'zh-')), name: 'Tingting' },
    ] as unknown as SpeechSynthesisVoice[];
    expect(pickVoice(list, 'en')?.name).toBe('Samantha');
    expect(pickVoice(list, 'zh')?.name).toBe('Tingting');
    expect(pickVoice([voice('zh-HK')] as unknown as SpeechSynthesisVoice[], 'zh')?.lang).toBe('zh-HK');
  });

  it('uses no lookbehind regex anywhere in src (older Safari cannot parse one, and it would break the whole app)', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
    const hits = walk('src').filter((f) => /\.(ts|tsx)$/.test(f) && /\(\?<[=!]/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('reads from the heading down and skips controls', () => {
    const el = document.createElement('article');
    el.innerHTML =
      '<div class="quiz">Quiz text</div><header class="panel-header"><p>Tray</p><h2>Name<button>Copy link</button></h2></header>' +
      '<section><h3>What it is</h3><p>A thing<span aria-hidden="true">✓</span></p></section><p role="status">Saved</p>';
    expect(panelText(el)).toBe('Tray. Name. What it is. A thing.');
  });
});
