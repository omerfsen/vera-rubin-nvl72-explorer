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

// ---- tray interior ------------------------------------------------------
// The open tray is drawn larger than in the rack so its parts are easy to
// click. Proportions follow a 1 RU, 19-inch tray; all of it is illustrative.
export const TRAY_WIDTH = 1.2;
export const TRAY_DEPTH = 1.9;
export const TRAY_HEIGHT = 0.11;

/** Colour per part type inside a tray. Ports are coloured by connector type. */
export const PART_COLORS: Partial<Record<ComponentType, string>> = {
  gpu: '#3fa796',
  cpu: '#4f7cc9',
  memory: '#c9b458',
  nic: '#d08a3a',
  dpu: '#8a6fd1',
  drive: '#8796a6',
  manifold: '#3aa0c4',
  board: '#5d8a52',
  bmc: '#b05f8a',
  controller: '#9c6aa8',
  battery: '#c4573f',
};

export const PORT_COLORS: Record<string, string> = {
  OSFP: '#d8c48a',
  QSFP: '#8fb2e6',
  RJ45: '#6fbf5c',
};

/** Placement of one tray slot in scene units: centre and size. */
export function slotBox(slot: { face: 'top' | 'front'; x: number; z: number; y?: number; w: number; d: number; h: number }): {
  position: [number, number, number];
  size: [number, number, number];
} {
  if (slot.face === 'front') {
    const height = slot.h * TRAY_HEIGHT;
    return {
      position: [slot.x * TRAY_WIDTH, (slot.y ?? 0.5) * TRAY_HEIGHT, TRAY_DEPTH / 2 + 0.012],
      size: [slot.w * TRAY_WIDTH, height, 0.024],
    };
  }
  const height = slot.h * TRAY_WIDTH;
  return {
    position: [slot.x * TRAY_WIDTH, 0.01 + height / 2, slot.z * TRAY_DEPTH],
    size: [slot.w * TRAY_WIDTH, height, slot.d * TRAY_DEPTH],
  };
}

/** Colour per link kind in the tray's connections layer. */
export const LINK_COLORS: Record<string, string> = {
  pcie: '#b58cf0',
  c2c: '#5fd3c4',
  clink: '#f0a35f',
  nvlink: '#e8e86a',
  coolant: '#4aa8ff',
  power: '#ff6b6b',
};

export const LINK_NAMES: Record<string, string> = {
  pcie: 'PCIe',
  c2c: 'C2C (CPU to GPU)',
  clink: 'Clink (CPU to CPU)',
  nvlink: 'NVLink (to the cable cartridge)',
  coolant: 'Coolant',
  power: 'Power',
};
