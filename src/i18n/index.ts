// UI strings and translated content from data/i18n/<lang>.json. English is
// the source and the fallback for every key; facts stay in the data file.
import en from '../../data/i18n/en.json';
import tr from '../../data/i18n/tr.json';
import zh from '../../data/i18n/zh.json';
import ru from '../../data/i18n/ru.json';
import es from '../../data/i18n/es.json';
import { model } from '../data';
import type { PathSegment } from '../data/model';
import type { Component, LinkEnd } from '../data/types';
import { useExplorer } from '../state/store';
import { DEFAULT_LANG, type Lang } from './lang';

export { LANGS, isLang, type Lang } from './lang';

type Tree = { [key: string]: unknown };
const FILES: Record<Lang, Tree> = { en, tr, zh, ru, es } as unknown as Record<Lang, Tree>;

function lookup(tree: unknown, path: readonly (string | number)[]): unknown {
  let node = tree;
  for (const p of path) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[String(p)];
  }
  return node;
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Fills "{name}" placeholders; unknown ones are left as they are. */
export function format(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function createI18n(lang: Lang) {
  const file = FILES[lang] ?? FILES[DEFAULT_LANG];
  const english = FILES[DEFAULT_LANG];

  /** A string from this language, else English, else the fallback. */
  function pick(path: readonly (string | number)[], fallback: string): string {
    const own = lookup(file, path);
    if (nonEmpty(own)) return own;
    const base = lookup(english, path);
    return nonEmpty(base) ? base : fallback;
  }

  /** A UI string by dotted key, e.g. t('panel.whatItIs') or t('count.perRack', { total: 72 }). */
  function t(key: string, vars?: Record<string, string | number>): string {
    return format(pick(['ui', ...key.split('.')], key), vars);
  }

  /** Content text for a path below "content", falling back to the English from the data. */
  function c<T extends string | undefined>(path: readonly (string | number)[], fallback: T): T {
    if (fallback === undefined || fallback === '') return fallback;
    return pick(['content', ...path], fallback) as T;
  }

  const nameOf = (id: string): string => {
    const comp = model.getComponent(id);
    return comp ? c(['components', id, 'name'], comp.name) : id;
  };

  function segmentLabel(segment: PathSegment): string {
    const name = nameOf(segment.id);
    return segment.index === undefined ? name : `${name} ${model.displayIndex(segment.id, segment.index)}`;
  }

  return {
    lang,
    t,
    /** Translated component name. */
    name: nameOf,
    /** Translated description, function or note of a component. */
    component: (comp: Component, field: 'description' | 'function' | 'note') => c(['components', comp.id, field], comp[field]),
    specLabel: (label: string) => c(['specLabels', label], label),
    specNote: <T extends string | undefined>(componentId: string, label: string, note: T) => c(['components', componentId, 'specNotes', label], note),
    network: <T extends string | undefined>(id: string, field: 'description' | 'note', fallback: T) => c(['networks', id, field], fallback),
    connection: <T extends string | undefined>(id: string, field: 'description' | 'note', fallback: T) => c(['connections', id, field], fallback),
    pcieNote: <T extends string | undefined>(note: T) => c(['pcieNotes', note ?? ''], note),
    procedureTitle: (id: string, fallback: string) => c(['procedures', id, 'title'], fallback),
    procedureStep: (id: string, step: number, fallback: string) => c(['procedures', id, 'steps', step], fallback),
    question: (id: string, field: 'title' | 'summary', fallback: string) => c(['openQuestions', id, field], fallback),
    software: <T extends string | undefined>(id: string, field: 'description' | 'note', fallback: T) => c(['software', id, field], fallback),
    safety: (id: string, field: 'title' | 'text', fallback: string) => c(['safety', id, field], fallback),
    command: <T extends string | undefined>(id: string, field: 'group' | 'title' | 'purpose' | 'note', fallback: T) => c(['commands', id, field], fallback),
    commandNote: (field: 'usage' | 'factoryReset', fallback: string) => c(['commandNotes', field], fallback),
    fabric: <T extends string | undefined>(field: 'description' | 'note', fallback: T) => c(['nvlinkFabric', field], fallback),
    rackNote: <T extends string | undefined>(fallback: T) => c(['rackLayout', 'note'], fallback),
    numberingNote: <T extends string | undefined>(fallback: T) => c(['rackLayout', 'numbering'], fallback),
    overrideNote: <T extends string | undefined>(id: string, fallback: T) => c(['rackLayout', 'overrides', id], fallback),
    heightNote: <T extends string | undefined>(id: string, fallback: T) => c(['rackLayout', 'heights', id], fallback),
    trayNote: <T extends string | undefined>(trayId: string, fallback: T) => c(['trayLayouts', trayId, 'note'], fallback),
    notPlaced: (trayId: string, componentId: string, fallback: string) => c(['trayLayouts', trayId, 'notPlaced', componentId], fallback),
    linkNote: <T extends string | undefined>(trayId: string, linkIndex: number, fallback: T) => c(['trayLayouts', trayId, 'links', linkIndex], fallback),
    pointLabel: (trayId: string, pointId: string, fallback: string) => c(['trayLayouts', trayId, 'points', pointId], fallback),
    rearNote: <T extends string | undefined>(fallback: T) => c(['rearLayout', 'note'], fallback),
    glossary: <T extends string | undefined>(id: string, field: 'expansion' | 'definition', fallback: T) => c(['glossary', id, field], fallback),
    /** Translated summary of a changelog entry. */
    change: (id: string, fallback: string) => c(['changelog', id, 'summary'], fallback),
    /** Translated note on the document version a changelog entry reflects. */
    changeNote: (id: string, document: string, fallback: string) => c(['changelog', id, 'reflects', document], fallback),
    /** "Compute tray 7", translated. */
    segmentLabel,
    /** Kind shown above the panel title: "compute tray", "gpu", ... */
    typeName: (type: string) => t(`types.${type}`),
    /** Name of a link or connection kind: "PCIe", "Coolant", ... */
    linkName: (kind: string) => t(`links.${kind}`),
    /** Display name of a link end inside a tray: NVIDIA's slot label, the part name and number, or the point label. */
    linkEndLabel(trayId: string, end: LinkEnd): string {
      const layout = model.trayLayout(trayId);
      if (end.point !== undefined) {
        const point = layout?.points?.find((p) => p.id === end.point);
        return point ? c(['trayLayouts', trayId, 'points', point.id], point.label) : end.point;
      }
      const slot = layout?.slots.find((s) => s.component === end.component && s.index === end.index);
      if (slot?.label) return slot.label;
      return segmentLabel({ id: end.component, index: end.index });
    },
  };
}

export type I18n = ReturnType<typeof createI18n>;

const cache = new Map<Lang, I18n>();

/** The translator for a language; one instance per language. */
export function i18nFor(lang: Lang): I18n {
  let i = cache.get(lang);
  if (!i) {
    i = createI18n(lang);
    cache.set(lang, i);
  }
  return i;
}

/** The translator for the language currently chosen in the store. */
export function useI18n(): I18n {
  return i18nFor(useExplorer((s) => s.lang));
}
