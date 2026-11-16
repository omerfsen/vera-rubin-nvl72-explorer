// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Recorder } from '../src/components/Recorder';
import { recordingName, recordingType, supportedTypes } from '../src/lib/recorder';

const conv = vi.hoisted(() => ({ fail: new Set<string>(), made: [] as string[] }));
vi.mock('mediabunny', () => {
  class Mp4OutputFormat { kind = 'mp4'; }
  class WebMOutputFormat { kind = 'webm'; }
  class BufferTarget { buffer: ArrayBuffer | null = null; }
  class Output { constructor(public o: { format: { kind: string }; target: BufferTarget }) {} }
  class Conversion {
    isValid = true;
    onProgress?: (p: number) => void;
    constructor(private out: Output) {}
    static async init({ output }: { output: Output }) { return new Conversion(output); }
    async execute() {
      const kind = this.out.o.format.kind;
      if (conv.fail.has(kind)) throw new Error('boom');
      conv.made.push(kind);
      this.onProgress?.(1);
      this.out.o.target.buffer = new ArrayBuffer(4);
    }
  }
  return {
    Input: class {}, BlobSource: class {}, ALL_FORMATS: [], QUALITY_HIGH: {},
    canEncodeAudio: async () => true,
    Mp4OutputFormat, WebMOutputFormat, BufferTarget, Output, Conversion,
  };
});

/** A MediaRecorder that hands back one chunk on stop. */
function fakeMedia(mp4: boolean) {
  const made: string[] = [];
  const recorded: string[][] = [];
  class FakeRecorder {
    static isTypeSupported = (t: string) => t.startsWith('video/webm') || (mp4 && t.startsWith('video/mp4'));
    tracks: string[];
    state = 'inactive';
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor(s: { kinds: string[] }, opts: { mimeType: string }) {
      made.push(opts.mimeType);
      this.tracks = s.kinds;
      recorded.push(s.kinds);
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
  const track = { kind: 'video', stop: vi.fn(), addEventListener: vi.fn() };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const micTrack = { kind: 'audio', stop: vi.fn() };
  const micStream = { getTracks: () => [micTrack], getAudioTracks: () => [micTrack] };
  const getDisplayMedia = vi.fn().mockResolvedValue(stream);
  const getUserMedia = vi.fn().mockResolvedValue(micStream);
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal(
    'MediaStream',
    class {
      kinds: string[];
      constructor(tracks: { kind: string }[]) {
        this.kinds = tracks.map((t) => t.kind);
      }
    },
  );
  Object.defineProperty(navigator, 'mediaDevices', { value: { getDisplayMedia, getUserMedia }, configurable: true });
  const saved: string[] = [];
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.download);
  });
  return { made, recorded, saved, getDisplayMedia, getUserMedia, track, micTrack };
}

afterEach(() => {
  conv.fail.clear();
  conv.made.length = 0;
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

  it('records WebM when it can, and the browser MP4 only without WebM', () => {
    expect(recordingType({ webm: 'video/webm', mp4: 'video/mp4' })).toEqual({ format: 'webm', mimeType: 'video/webm' });
    expect(recordingType({ mp4: 'video/mp4' })).toEqual({ format: 'mp4', mimeType: 'video/mp4' });
    expect(recordingType({})).toBeNull();
  });

  it('names files by date and format', () => {
    expect(recordingName('mp4', new Date(2026, 10, 16, 9, 5, 7))).toBe('vr-nvl72-20261116-090507.mp4');
  });

  it('is hidden when the browser cannot capture the screen', () => {
    render(<Recorder />);
    expect(screen.queryByRole('button', { name: 'Record' })).toBeNull();
  });

  it('records WebM, then saves a rewritten WebM and a converted MP4', async () => {
    const m = fakeMedia(true);
    render(<Recorder />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Record' })));
    expect(m.getDisplayMedia).toHaveBeenCalledOnce();
    expect(m.made).toEqual(['video/webm;codecs=vp9']);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Stop and save/ })));
    expect(m.saved).toHaveLength(2);
    expect(m.saved[0]).toMatch(/^vr-nvl72-\d{8}-\d{6}\.webm$/);
    expect(m.saved[1]).toMatch(/\.mp4$/);
    expect(m.track.stop).toHaveBeenCalled();
    expect(conv.made).toEqual(['webm', 'mp4']);
    expect(screen.getByRole('status').textContent).toBe('Saved: WEBM, MP4.');
  });

  it('saves WebM only and says so when the MP4 conversion fails', async () => {
    const m = fakeMedia(true);
    conv.fail.add('mp4');
    render(<Recorder />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Record' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Stop and save/ })));
    expect(m.saved).toHaveLength(1);
    expect(m.saved[0]).toMatch(/\.webm$/);
    expect(screen.getByRole('status').textContent).toContain('only WebM');
  });

  it('keeps the raw WebM when the WebM rewrite fails', async () => {
    const m = fakeMedia(true);
    conv.fail.add('webm');
    render(<Recorder />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Record' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Stop and save/ })));
    expect(m.saved).toHaveLength(2);
    expect(conv.made).toEqual(['mp4']);
  });

  it('reports a refused screen share', async () => {
    const m = fakeMedia(true);
    m.getDisplayMedia.mockRejectedValueOnce(new Error('NotAllowedError'));
    render(<Recorder />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Record' })));
    expect(screen.getByRole('status').textContent).toContain('not allowed');
    expect(screen.getByRole('button', { name: 'Record' })).toBeTruthy();
  });

  it('records without the microphone unless Voice is ticked', async () => {
    const m = fakeMedia(true);
    render(<Recorder />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Record' })));
    expect(m.getUserMedia).not.toHaveBeenCalled();
    expect(m.recorded[0]).toEqual(['video']);
  });

  it('adds the voice track when Voice is ticked, and stops the microphone', async () => {
    const m = fakeMedia(true);
    render(<Recorder />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Voice' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Record' })));
    expect(m.getUserMedia).toHaveBeenCalledOnce();
    expect(m.made).toEqual(['video/webm;codecs=vp9,opus']);
    expect(m.recorded[0]).toEqual(['video', 'audio']);
    expect(screen.getByRole('checkbox', { name: 'Voice' })).toHaveProperty('disabled', true);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Stop and save/ })));
    expect(m.micTrack.stop).toHaveBeenCalled();
    expect(m.saved).toHaveLength(2);
  });

  it('records the screen without sound when the microphone is refused', async () => {
    const m = fakeMedia(true);
    m.getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'));
    render(<Recorder />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Voice' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Record' })));
    expect(m.recorded[0]).toEqual(['video']);
    expect(screen.getByRole('status').textContent).toContain('no voice');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Stop and save/ })));
    expect(m.saved).toHaveLength(2);
    expect(screen.getByRole('status').textContent).toContain('no voice');
  });
});
