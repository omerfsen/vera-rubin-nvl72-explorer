// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { recordingName } from '../src/lib/recorder';
import { collectLabels, fitText, screenshotAvailable, setCaptureSource } from '../src/lib/screenshot';
import { screenshotCaption } from '../src/components/screenshotCaption';
import { i18nFor } from '../src/i18n';

const shot = vi.hoisted(() => ({ composeFails: false }));
vi.mock('../src/lib/screenshot', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/lib/screenshot')>();
  return {
    ...real,
    // jsdom has no 2D canvas: hand back a canvas whose PNG is a fixed blob.
    compose: () => {
      if (shot.composeFails) throw new Error('boom');
      const c = document.createElement('canvas');
      c.toBlob = (cb: BlobCallback) => cb(new Blob(['png'], { type: 'image/png' }));
      return c;
    },
  };
});

const { Screenshot } = await import('../src/components/Screenshot');

const en = i18nFor('en');
const HREF = 'https://verarubin-nvl72.faruk.net/?select=compute-tray.2';

afterEach(() => {
  cleanup();
  shot.composeFails = false;
  setCaptureSource(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

function fakeSource() {
  const root = document.createElement('div');
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);
  setCaptureSource({ root, render: () => canvas });
}

function catchSaves(): string[] {
  const saved: string[] = [];
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.download);
  });
  return saved;
}

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

describe('screenshot', () => {
  it('is named like the recordings', () => {
    expect(recordingName('png', new Date(2026, 10, 16, 9, 5, 7))).toBe('vr-nvl72-20261116-090507.png');
  });

  it('captions the selected part, the view and the site', () => {
    expect(screenshotCaption({ selected: '', view: 'rack' }, en, HREF)).toEqual({
      subject: 'DGX Vera Rubin NVL72 rack · Front view',
      site: 'Vera Rubin NVL72 Explorer · verarubin-nvl72.faruk.net',
    });
    expect(screenshotCaption({ selected: 'compute-tray.2', view: 'rear' }, en, HREF).subject).toBe('Compute tray 2 · Rear view');
    expect(screenshotCaption({ selected: 'compute-tray.2', view: 'tray' }, en, HREF).subject).toBe('Compute tray 2 · Tray view');
    const tr = screenshotCaption({ selected: 'compute-tray.2', view: 'rack' }, i18nFor('tr'), 'https://example.org/sub/');
    expect(tr.subject).toContain('Önden görünüm');
    expect(tr.site).toMatch(/· example\.org\/sub$/);
  });

  it('draws only the labels that are shown, at their place on the canvas', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="group-label"><span data-label id="a">Compute trays</span></div>
      <div class="group-label"><span data-label class="label-hidden" id="b">Hidden by layout</span></div>
      <div style="display:none"><span data-label id="c">Hidden by CSS</span></div>
      <div><span data-label id="d">Off the canvas</span></div>
      <div><span data-label id="e" style="text-transform:uppercase">front</span></div>`;
    document.body.appendChild(root);
    const boxes: Record<string, DOMRect> = {
      a: rect(110, 60, 80, 16),
      b: rect(110, 90, 80, 16),
      c: rect(110, 120, 80, 16),
      d: rect(900, 60, 80, 16),
      e: rect(200, 200, 40, 16),
    };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return boxes[this.id] ?? rect(0, 0, 0, 0);
    });
    const labels = collectLabels(root, rect(100, 50, 400, 300), 2);
    expect(labels.map((l) => l.text)).toEqual(['Compute trays', 'FRONT']);
    expect(labels[0]).toMatchObject({ x: 20, y: 36 });
    root.remove();
  });

  it('cuts a caption that does not fit', () => {
    expect(fitText((s) => s.length, 'Compute tray 2', 100)).toBe('Compute tray 2');
    expect(fitText((s) => s.length, 'Compute tray 2', 8)).toBe('Compute…');
  });

  it('shows only with the flag, WebGL and outside an embed', () => {
    expect(screenshotAvailable({ flag: true, webgl: true, embed: false })).toBe(true);
    expect(screenshotAvailable({ flag: true, webgl: true, embed: true })).toBe(false);
    expect(screenshotAvailable({ flag: true, webgl: false, embed: false })).toBe(false);
    expect(screenshotAvailable({ flag: false, webgl: true, embed: false })).toBe(false);
  });

  it('saves a PNG and says so', async () => {
    fakeSource();
    const saved = catchSaves();
    render(<Screenshot />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Screenshot' })));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatch(/^vr-nvl72-\d{8}-\d{6}\.png$/);
    expect(screen.getByRole('status').textContent).toBe('Screenshot saved.');
  });

  it('reports a failure when there is no 3D view or drawing fails', async () => {
    const saved = catchSaves();
    render(<Screenshot />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Screenshot' })));
    expect(screen.getByRole('status').textContent).toBe('The screenshot could not be taken.');
    fakeSource();
    shot.composeFails = true;
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Screenshot' })));
    expect(screen.getByRole('status').textContent).toBe('The screenshot could not be taken.');
    expect(saved).toHaveLength(0);
  });

  it('says so when the browser cannot copy images', async () => {
    fakeSource();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, configurable: true });
    render(<Screenshot />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy image' })));
    expect(screen.getByRole('status').textContent).toContain('cannot copy images');
  });

  it('copies a PNG to the clipboard, and reports a refusal', async () => {
    fakeSource();
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
    vi.stubGlobal(
      'ClipboardItem',
      class {
        constructor(public items: Record<string, Promise<Blob>>) {}
      },
    );
    render(<Screenshot />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy image' })));
    expect(write).toHaveBeenCalledOnce();
    const item = write.mock.calls[0]![0][0] as { items: Record<string, Promise<Blob>> };
    expect((await item.items['image/png']!).type).toBe('image/png');
    expect(screen.getByRole('status').textContent).toBe('Image copied.');
    write.mockRejectedValueOnce(new Error('NotAllowedError'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy image' })));
    expect(screen.getByRole('status').textContent).toContain('could not be copied');
  });
});
