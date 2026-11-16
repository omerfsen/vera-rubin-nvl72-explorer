// A PNG of the 3D view, made in the browser: the WebGL canvas, the visible
// HTML labels drawn over it, and a caption bar. Nothing is uploaded.
//
// The canvas is created without preserveDrawingBuffer (keeping it would cost
// a copy on every frame), so its pixels are only defined right after a
// render. The scene registers a source that renders a frame and hands back
// the canvas; the image is copied onto a 2D canvas in that same task, before
// the browser can clear the drawing buffer.

/** What the scene hands over: renders a fresh frame and returns its canvas. */
export interface CaptureSource {
  /** Renders the scene now and returns the WebGL canvas, ready to copy in this task. */
  render(): HTMLCanvasElement;
  /** The element that holds the canvas and the HTML labels. */
  root: HTMLElement;
}

let source: CaptureSource | null = null;

/** Called by the scene when it mounts (and with null when it unmounts). */
export function setCaptureSource(next: CaptureSource | null): void {
  source = next;
}

export function captureSource(): CaptureSource | null {
  return source;
}

export interface LabelDraw {
  text: string;
  /** Left edge and vertical centre, in canvas pixels. */
  x: number;
  y: number;
  font: string;
  color: string;
  letterSpacing: number;
  /** A filled box behind the text, when the label has a background. */
  box: { x: number; y: number; w: number; h: number; fill: string } | null;
}

const transparent = (c: string) => !c || c === 'transparent' || /rgba?\([^)]*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);

/**
 * The labels to draw, in canvas pixels. A label is skipped when the label
 * layout hid it (`label-hidden`), when CSS hides it or one of its parents,
 * or when it lies outside the canvas.
 */
export function collectLabels(root: ParentNode, canvasRect: DOMRect, scale: number): LabelDraw[] {
  const out: LabelDraw[] = [];
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-label]'))) {
    if (el.closest('.label-hidden')) continue;
    const text = (el.textContent ?? '').trim();
    if (!text) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
    if (hiddenByParent(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right <= canvasRect.left || r.left >= canvasRect.right || r.bottom <= canvasRect.top || r.top >= canvasRect.bottom) continue;
    const left = (r.left - canvasRect.left) * scale;
    const top = (r.top - canvasRect.top) * scale;
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const size = (parseFloat(style.fontSize) || 12) * scale;
    const bg = style.backgroundColor;
    out.push({
      text: style.textTransform === 'uppercase' ? text.toUpperCase() : text,
      x: left + padLeft * scale,
      y: top + (r.height * scale) / 2,
      font: `${style.fontWeight || 'normal'} ${size}px ${style.fontFamily || 'sans-serif'}`,
      color: style.color || '#888',
      letterSpacing: (parseFloat(style.letterSpacing) || 0) * scale,
      box: transparent(bg) ? null : { x: left, y: top, w: r.width * scale, h: r.height * scale, fill: bg },
    });
  }
  return out;
}

function hiddenByParent(el: HTMLElement): boolean {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return true;
  }
  return false;
}

/** Theme colours from the page's CSS variables. */
export function themeColors(el: Element = document.documentElement): { surface: string; border: string; text: string; muted: string; font: string } {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    surface: v('--surface', '#161a20'),
    border: v('--border', '#2a3039'),
    text: v('--text', '#e6e9ee'),
    muted: v('--muted', '#9aa3af'),
    font: s.fontFamily || 'sans-serif',
  };
}

/** Cuts text to fit a width, ending in an ellipsis. */
export function fitText(measure: (s: string) => number, text: string, width: number): string {
  if (measure(text) <= width) return text;
  let s = text;
  while (s.length > 0 && measure(s + '…') > width) s = s.slice(0, -1);
  return s ? s.trimEnd() + '…' : '';
}

export interface Caption {
  /** Left: what is shown and from which side. */
  subject: string;
  /** Right: the site's name and address. */
  site: string;
}

/** Caption bar height in CSS pixels. */
export const CAPTION_HEIGHT = 28;

/**
 * Draws the frame, the labels and the caption on a new 2D canvas. Must run
 * in the same task as `source.render()`.
 */
export function compose(source: CaptureSource, caption: Caption): HTMLCanvasElement {
  const gl = source.render();
  const rect = gl.getBoundingClientRect();
  const scale = rect.width > 0 ? gl.width / rect.width : window.devicePixelRatio || 1;
  const bar = Math.round(CAPTION_HEIGHT * scale);
  const out = document.createElement('canvas');
  out.width = gl.width;
  out.height = gl.height + bar;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('no-2d');
  ctx.drawImage(gl, 0, 0);

  const ls = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  ctx.textBaseline = 'middle';
  for (const l of collectLabels(source.root, rect, scale)) {
    if (l.box) {
      ctx.fillStyle = l.box.fill;
      ctx.fillRect(l.box.x, l.box.y, l.box.w, l.box.h);
    }
    ctx.font = l.font;
    ctx.fillStyle = l.color;
    ctx.textAlign = 'left';
    if ('letterSpacing' in ls) ls.letterSpacing = `${l.letterSpacing}px`;
    ctx.fillText(l.text, l.x, l.y);
  }
  if ('letterSpacing' in ls) ls.letterSpacing = '0px';

  const theme = themeColors();
  const y0 = gl.height;
  ctx.fillStyle = theme.surface;
  ctx.fillRect(0, y0, out.width, bar);
  ctx.fillStyle = theme.border;
  ctx.fillRect(0, y0, out.width, Math.max(1, Math.round(scale)));
  const pad = 10 * scale;
  const mid = y0 + bar / 2;
  ctx.font = `${12 * scale}px ${theme.font}`;
  const measure = (s: string) => ctx.measureText(s).width;
  const site = fitText(measure, caption.site, out.width / 2 - pad * 1.5);
  ctx.fillStyle = theme.muted;
  ctx.textAlign = 'right';
  ctx.fillText(site, out.width - pad, mid);
  const room = out.width - pad * 3 - measure(site);
  ctx.font = `600 ${12 * scale}px ${theme.font}`;
  ctx.fillStyle = theme.text;
  ctx.textAlign = 'left';
  ctx.fillText(fitText(measure, caption.subject, room), pad, mid);
  return out;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no-png'))), 'image/png'));
}

/** True when this browser can put an image on the clipboard. */
export function canCopyImage(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function' &&
    typeof ClipboardItem !== 'undefined' &&
    (typeof ClipboardItem.supports !== 'function' || ClipboardItem.supports('image/png'))
  );
}

/**
 * Puts a PNG on the clipboard. The ClipboardItem is made at once with a
 * promise, so Safari still counts the click as the user's gesture.
 */
export async function copyPng(png: Promise<Blob>): Promise<boolean> {
  if (!canCopyImage()) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  } catch {
    return false;
  }
}

/** The button shows only with the flag on, a 3D view to capture, and outside an embed. */
export function screenshotAvailable({ flag, webgl, embed }: { flag: boolean; webgl: boolean; embed: boolean }): boolean {
  return flag && webgl && !embed;
}
