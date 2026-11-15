import type { RackUnit } from '../data/model';
import type { ComponentType } from '../data/types';

// Illustrative dimensions in metres. Only the rack unit height and the 19-inch
// width are standard; depth and frame sizes are chosen to read well on screen.
export const RU = 0.04445;
export const UNIT_WIDTH = 0.4826;
export const UNIT_DEPTH = 0.9;
export const FRAME_WIDTH = 0.6;
export const FRAME_POST = 0.035;
/** Gap between neighbouring units so their edges stay visible. */
export const UNIT_GAP = 0.0025;
export const FRAME_MARGIN_RU = 1.5;

export interface UnitBox {
  key: string;
  /** Centre of the box. */
  position: [number, number, number];
  size: [number, number, number];
}

/** Box for each rack unit, with the stack centred on y = 0. */
export function unitBoxes(units: RackUnit[], totalRU: number): UnitBox[] {
  const top = (totalRU * RU) / 2;
  return units.map((u) => {
    const height = u.heightRU * RU - UNIT_GAP;
    const y = top - (u.topRU + u.heightRU / 2) * RU;
    return { key: u.key, position: [0, y, 0], size: [UNIT_WIDTH, height, UNIT_DEPTH] };
  });
}

export function frameHeight(totalRU: number): number {
  return (totalRU + 2 * FRAME_MARGIN_RU) * RU;
}

/** Base colour per unit type; also used by the legend and the 2D list. */
export const TYPE_COLORS: Partial<Record<ComponentType, string>> = {
  'compute-tray': '#8b7d5c',
  'switch-tray': '#5f7f8f',
  'power-shelf': '#5a5f69',
  'tor-switch': '#7a6a8f',
};

export const HOVER_COLOR = '#d6c89a';
export const SELECTED_COLOR = '#38bdf8';
