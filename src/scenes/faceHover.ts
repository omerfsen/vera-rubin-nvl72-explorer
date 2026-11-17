import { model } from '../data';
import type { I18n } from '../i18n';

/** Path of a part on a rack unit's front face: the unit key, then the part's path inside the unit. */
export function facePartPath(unitKey: string, unitType: string, slot: { component: string; index?: number }): string {
  return `${unitKey}/${model.slotPathWithin(unitType, slot)}`;
}

/**
 * Text of the rack view's hover tag: the unit's name, or for a part on its
 * front face "<part> · <unit>". Null when the path is neither.
 */
export function hoverTagText(hovered: string, i18n: I18n): string | null {
  const [key = '', ...rest] = hovered.split('/');
  const unit = model.rackUnitByKey.get(key);
  if (!unit) return null;
  const unitName = i18n.segmentLabel({ id: unit.componentId, index: unit.index });
  if (rest.length === 0) return unitName;
  const slot = model.slotFor(unit.componentId, rest.join('/'));
  if (!slot) return null;
  return i18n.t('scene.partInUnit', { part: i18n.slotLabel(slot), unit: unitName });
}

export type FaceClick = 'unit' | 'part' | 'tray';

/**
 * What a click on a front-face part does, in stages: the first click selects
 * its unit (as a click on the unit always has), the next selects the part,
 * and a click on the selected part opens the unit.
 */
export function faceClickAction(path: string, selected: string): FaceClick {
  if (selected === path) return 'tray';
  const unitKey = path.split('/')[0];
  return selected.split('/')[0] === unitKey ? 'part' : 'unit';
}
