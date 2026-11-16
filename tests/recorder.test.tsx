// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Recorder } from '../src/components/Recorder';
import { recordingName, supportedTypes } from '../src/lib/recorder';

/** A MediaRecorder that hands back one chunk on stop. */
function fakeMedia(mp4: boolean) {
  const made: string[] = [];
  class FakeRecorder {
    static isTypeSupported = (t: string) => t.startsWith('video/webm') || (mp4 && t.startsWith('video/mp4'));
    state = 'inactive';
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor(_s: unknown, opts: { mimeType: string }) {
      made.push(opts.mimeType);
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['x']) });
      this.onstop?.();
    }
  }
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const getDisplayMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getDisplayMedia }, configurable: true });
  const saved: string[] = [];
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.download);
  });
  return { made, saved, getDisplayMedia, track };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
});

describe('recorder', () => {
  it('picks the first supported type per format', () => {
    expect(supportedTypes((t) => t === 'video/webm;codecs=vp8' || t === 'video/mp4')).toEqual({
      webm: 'video/webm;codecs=vp8',
      mp4: 'video/mp4',
    });
    expect(supportedTypes(() => false)).toEqual({});
  });

  it('names files by date and format', () => {
    expect(recordingName('mp4', new Date(2026, 10, 16, 9, 5, 7))).toBe('vr-nvl72-20261116-090507.mp4');
  });

  it('is hidden when the browser cannot capture the screen', () => {
    render(<Recorder />);
    expect(screen.queryByRole('button', { name: 'Record' })).toBeNull();
  });

  it('records and saves both WebM and MP4', async () => {
    const m = fakeMedia(true);
    render(<Recorder />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Record' })));
    expect(m.getDisplayMedia).toHaveBeenCalledOnce();
    expect(m.made).toEqual(['video/webm;codecs=vp9', 'video/mp4;codecs=avc1.42E01E']);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Stop and save/ })));
    expect(m.saved).toHaveLength(2);
    expect(m.saved[0]).toMatch(/^vr-nvl72-\d{8}-\d{6}\.webm$/);
    expect(m.saved[1]).toMatch(/\.mp4$/);
    expect(m.track.stop).toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('Saved: WEBM, MP4.');
  });

  it('saves WebM only and says so when MP4 is not supported', async () => {
    const m = fakeMedia(false);
    render(<Recorder />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Record' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Stop and save/ })));
    expect(m.saved).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toContain('only WebM');
  });

  it('reports a refused screen share', async () => {
    const m = fakeMedia(true);
    m.getDisplayMedia.mockRejectedValueOnce(new Error('NotAllowedError'));
    render(<Recorder />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Record' })));
    expect(screen.getByRole('status').textContent).toContain('not allowed');
    expect(screen.getByRole('button', { name: 'Record' })).toBeTruthy();
  });
});
