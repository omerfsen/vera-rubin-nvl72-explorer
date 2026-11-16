/**
 * Screen-space label collision handling. Pure: takes label boxes in screen
 * pixels and returns, for each, whether to show it and how far to nudge it.
 */

export interface LabelBox {
  id: string;
  /** Left edge, in screen pixels, where the label sits before any nudge. */
  x: number;
  /** Top edge, in screen pixels, where the label sits before any nudge. */
  y: number;
  width: number;
  height: number;
  /** Higher keeps its place first; ties go to the earlier label. */
  priority?: number;
  /** Always shown (the hovered or selected part's label). */
  pinned?: boolean;
}

export interface LabelPlacement {
  id: string;
  visible: boolean;
  dx: number;
  dy: number;
}

export interface LabelLayoutOptions {
  /** Minimum free space kept between two labels, in pixels. */
  gap?: number;
  /** Furthest a label may be nudged before it is hidden instead, in pixels. */
  maxShift?: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** True when two boxes come closer than `gap` on both axes. */
export function overlaps(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;
}

/**
 * Places labels in priority order (pinned first, then higher `priority`, then
 * input order). Each label keeps its own spot if it is free; otherwise it moves
 * up or down to the nearest free spot within `maxShift`, and failing that it is
 * hidden. A pinned label is never hidden. Results come back in input order.
 * Labels that do not collide are left exactly where they are.
 */
export function resolveLabels(labels: readonly LabelBox[], options: LabelLayoutOptions = {}): LabelPlacement[] {
  const gap = options.gap ?? 2;
  const maxShift = options.maxShift ?? 24;
  const order = labels
    .map((label, index) => ({ label, index }))
    .sort(
      (a, b) =>
        Number(!!b.label.pinned) - Number(!!a.label.pinned) ||
        (b.label.priority ?? 0) - (a.label.priority ?? 0) ||
        a.index - b.index,
    );
  const placed: Rect[] = [];
  const result: LabelPlacement[] = new Array(labels.length);
  for (const { label, index } of order) {
    const free = (dy: number) => {
      const box = { x: label.x, y: label.y + dy, width: label.width, height: label.height };
      return placed.every((p) => !overlaps(box, p, gap));
    };
    let dy: number | null = free(0) ? 0 : null;
    if (dy === null) {
      // The only spots worth trying sit just above or just below a placed label.
      const candidates: number[] = [];
      for (const p of placed) {
        if (label.x >= p.x + p.width + gap || p.x >= label.x + label.width + gap) continue;
        candidates.push(p.y - gap - label.height - label.y, p.y + p.height + gap - label.y);
      }
      candidates.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
      dy = candidates.find((c) => Math.abs(c) <= maxShift && free(c)) ?? null;
    }
    if (dy === null && label.pinned) dy = 0;
    if (dy === null) {
      result[index] = { id: label.id, visible: false, dx: 0, dy: 0 };
      continue;
    }
    placed.push({ x: label.x, y: label.y + dy, width: label.width, height: label.height });
    result[index] = { id: label.id, visible: true, dx: 0, dy };
  }
  return result;
}
