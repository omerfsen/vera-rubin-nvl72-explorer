import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { resolveLabels, type LabelBox } from './labelLayout';

/** Least time between two layout passes while the camera keeps moving. */
const THROTTLE_MS = 100;
/** A label nudged further than its own height gets a leader line to its anchor. */
const LEADER_FACTOR = 1;

/**
 * Keeps the scene's HTML labels from overlapping. Any element inside the
 * canvas container with a `data-label` attribute takes part; it may carry
 * `data-label-priority` (a number, higher wins) and `data-label-pinned`
 * (always shown). Runs only after the camera, the canvas size or the labels
 * themselves change, at most once per THROTTLE_MS, with one batch of
 * getBoundingClientRect reads followed by one batch of style writes.
 */
export function LabelDeconflict() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const connected = useThree((s) => s.events.connected) as HTMLElement | undefined;
  const root = connected ?? gl.domElement.parentElement;
  const last = useRef<number[]>([]);
  const schedule = useRef<() => void>(() => {});

  useEffect(() => {
    if (!root) return;
    const applied = new WeakMap<HTMLElement, number>();
    let lastRun = 0;
    let pending: number | null = null;
    let frame: number | null = null;

    const run = () => {
      pending = null;
      frame = null;
      lastRun = performance.now();
      const els = Array.from(root.querySelectorAll<HTMLElement>('[data-label]'));
      // Reads first, all together.
      const rects = els.map((el) => el.getBoundingClientRect());
      const boxes: LabelBox[] = [];
      const index: number[] = [];
      rects.forEach((r, i) => {
        if (r.width === 0 || r.height === 0) return; // not rendered (hidden by CSS or off)
        const el = els[i]!;
        const priority = Number(el.dataset.labelPriority);
        boxes.push({
          id: String(i),
          x: r.left,
          y: r.top - (applied.get(el) ?? 0),
          width: r.width,
          height: r.height,
          priority: Number.isFinite(priority) ? priority : 0,
          pinned: el.dataset.labelPinned === 'true',
        });
        index.push(i);
      });
      const placements = resolveLabels(boxes);
      // Then writes.
      placements.forEach((p, k) => {
        const el = els[index[k]!]!;
        const h = boxes[k]!.height;
        applied.set(el, p.dy);
        el.style.translate = p.dy ? `0 ${p.dy}px` : '';
        el.classList.toggle('label-hidden', !p.visible);
        const leader = p.visible && Math.abs(p.dy) > h * LEADER_FACTOR;
        el.classList.toggle('label-leader', leader);
        if (leader) {
          // A vertical line from the moved label's near edge back to where it was.
          const top = p.dy < 0 ? h : h / 2 - p.dy;
          el.style.setProperty('--leader-top', `${top}px`);
          el.style.setProperty('--leader-height', `${Math.abs(p.dy) - h / 2}px`);
        }
      });
    };

    const request = () => {
      if (pending !== null || frame !== null) return;
      const wait = THROTTLE_MS - (performance.now() - lastRun);
      // Let drei's labels take their new positions this frame, then measure.
      if (wait > 0) pending = window.setTimeout(() => (frame = requestAnimationFrame(run)), wait);
      else frame = requestAnimationFrame(run);
    };
    schedule.current = request;

    // Labels mounting, unmounting, changing text (language) or priority (selection).
    const observer = new MutationObserver(request);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-label-pinned', 'data-label-priority'],
    });
    request();
    return () => {
      observer.disconnect();
      if (pending !== null) clearTimeout(pending);
      if (frame !== null) cancelAnimationFrame(frame);
      schedule.current = () => {};
    };
  }, [root]);

  // With frameloop="demand" this runs only on frames that are drawn; it
  // schedules a pass when the camera or the canvas size really changed.
  useFrame(() => {
    const now = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements, size.width, size.height];
    const prev = last.current;
    if (prev.length === now.length && now.every((v, i) => v === prev[i])) return;
    last.current = now;
    schedule.current();
  });
  return null;
}
