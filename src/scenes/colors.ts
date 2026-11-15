// Colour helpers shared by the 3D scenes and the DOM legend. No three.js here,
// so the legend does not pull the 3D bundle into the main chunk.
import { model } from '../data';
import { PART_COLORS, PORT_COLORS } from './geometry';
import { i18nFor, type I18n } from '../i18n';

/** Connector type of a port component ("OSFP", "QSFP", "RJ45"), or null. */
export function portType(componentId: string): string | null {
  const c = model.getComponent(componentId);
  if (c?.type !== 'port') return null;
  const value = c.specs.find((s) => s.label === 'Port type')?.value;
  return value === undefined ? null : String(value).replace('-', '');
}

/** Colour for a part: ports by connector type, everything else by component type. */
export function partColor(componentId: string): string {
  const c = model.getComponent(componentId);
  if (!c) return '#777777';
  const port = portType(componentId);
  if (port) return PORT_COLORS[port] ?? '#aaaaaa';
  return PART_COLORS[c.type] ?? '#888888';
}

/** True when a part instance is the selection, or belongs to a general selection of its type. */
export function isPartSelected(instancePath: string, selected: string): boolean {
  return instancePath === selected || instancePath.replace(/\.\d+$/, '') === selected;
}

/** Legend rows for a tray layout: one per part type, ports grouped by connector. */
export function trayLegend(trayId: string, i18n: I18n = i18nFor('en')): { label: string; color: string }[] {
  const rows = new Map<string, string>();
  for (const slot of model.trayLayout(trayId)?.slots ?? []) {
    const port = portType(slot.component);
    const label = port
      ? port === 'Not stated'
        ? i18n.t('legend.otherPort')
        : i18n.t('legend.port', { type: port })
      : i18n.name(slot.component);
    if (!rows.has(label)) rows.set(label, partColor(slot.component));
  }
  return [...rows.entries()].map(([label, color]) => ({ label, color }));
}
