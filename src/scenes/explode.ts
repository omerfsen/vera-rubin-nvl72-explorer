import type { TrayLayout, TraySlot } from '../data/types';
import { TRAY_DEPTH, TRAY_HEIGHT, TRAY_WIDTH } from './geometry';

type Vec = [number, number, number];

/** Vertical gap added between neighbouring layers when fully exploded. */
export const EXPLODE_STEP = 0.07;
/** How far parts on the front face move out of the tray when fully exploded. */
export const EXPLODE_FRONT = 0.18;
/** Parts on the tray floor also move away from its centre by this share of their distance to it. */
export const EXPLODE_SPREAD = 0.15;
/** Rate of the exponential ease towards the target, per second. */
const EXPLODE_RATE = 9;

/**
 * The layer a slot belongs to: parts on the tray floor by part type, parts
 * stacked inside a taller shelf by part type and row. Front-face parts are not
 * layered; they move out of the tray instead.
 */
export function layerKey(slot: TraySlot, typeOf: (component: string) => string): string {
  return slot.y === undefined ? typeOf(slot.component) : `${typeOf(slot.component)}@${slot.y}`;
}

/**
 * Full-explosion offset for every slot of a layout, in slot order. Layers are
 * ranked by height in a stacked shelf, then by the order they first appear in
 * the layout, so the data decides the stacking: the first layer stays on the
 * floor and each next one rises by EXPLODE_STEP (scaled with the shelf height
 * for tall shelves). Floor parts also spread out from the tray centre so they
 * stand apart when seen from above.
 */
export function explodeOffsets(layout: TrayLayout, typeOf: (component: string) => string): Vec[] {
  const first: { key: string; y: number }[] = [];
  for (const slot of layout.slots) {
    if (slot.face !== 'top') continue;
    const key = layerKey(slot, typeOf);
    if (!first.some((f) => f.key === key)) first.push({ key, y: slot.y ?? 0 });
  }
  // Stacked rows keep their bottom-to-top order; ties keep layout order.
  const order = first.sort((a, b) => a.y - b.y).map((f) => f.key);
  const step = EXPLODE_STEP + TRAY_HEIGHT * ((layout.heightRU ?? 1) - 1) * 0.15;
  return layout.slots.map((slot): Vec => {
    if (slot.face === 'front') return [0, 0, EXPLODE_FRONT];
    return [
      slot.x * TRAY_WIDTH * EXPLODE_SPREAD,
      order.indexOf(layerKey(slot, typeOf)) * step,
      slot.z * TRAY_DEPTH * EXPLODE_SPREAD,
    ];
  });
}

/** Scale an offset by the explosion amount (0 = assembled, 1 = exploded). */
export function scaleOffset(offset: Vec | undefined, amount: number): Vec {
  if (!offset || amount === 0) return [0, 0, 0];
  return [offset[0] * amount, offset[1] * amount, offset[2] * amount];
}

/**
 * Next animation value moving `current` towards `target` over `dt` seconds.
 * Snaps when close enough, so the animation settles and invalidation stops.
 */
export function stepExplode(current: number, target: number, dt: number): number {
  const next = current + (target - current) * (1 - Math.exp(-EXPLODE_RATE * Math.max(0, dt)));
  return Math.abs(target - next) < 0.002 ? target : next;
}

/** Whether the viewer asked the OS for less motion. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}
