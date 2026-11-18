import { model } from '../data';
import type { I18n } from '../i18n';

/** Path of a part on a rack unit's front face: the unit key, then the part's path inside the unit. */
export function facePartPath(unitKey: string, unitType: string, slot: { component: string; index?: number }): string {
  return `${unitKey}/${model.slotPathWithin(unitType, slot)}`;
}

/** Lines of the rack view's hover tag: the part on a unit's front face (if any), then the unit. */
export interface HoverTag {
  part: string | null;
  unit: string;
}

/**
 * Text of the rack view's hover tag: the unit's name, or for a part on its
 * front face the part's name over the unit's, on two lines so the tag stays
 * narrow on a phone. Null when the path is neither.
 */
export function hoverTag(hovered: string, i18n: I18n): HoverTag | null {
  const [key = '', ...rest] = hovered.split('/');
  const unit = model.rackUnitByKey.get(key);
  if (!unit) return null;
  const unitName = i18n.segmentLabel({ id: unit.componentId, index: unit.index });
  if (rest.length === 0) return { part: null, unit: unitName };
  const slot = model.slotFor(unit.componentId, rest.join('/'));
  if (!slot) return null;
  return { part: i18n.slotLabel(slot), unit: unitName };
}

export type FaceClick = 'unit' | 'open';

/**
 * What a click on a front-face part does. It keeps the rack's "tap a unit,
 * tap again to open" gesture: the first click selects its unit, and a click
 * on a part of the selected unit opens the unit with that part selected.
 */
export function faceClickAction(path: string, selected: string): FaceClick {
  const unitKey = path.split('/')[0];
  return selected.split('/')[0] === unitKey ? 'open' : 'unit';
}
