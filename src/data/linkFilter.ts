import type { Model } from './model';

/** Every connection kind drawn inside a tray, in the order the data first uses it. */
export function trayLinkKinds(model: Model): string[] {
  return [...new Set(Object.values(model.topology.trayLayouts ?? {}).flatMap((l) => (l.links ?? []).map((k) => k.kind)))];
}

/** The links still drawn once the hidden kinds are filtered out, with their index in the layout. */
export function visibleLinks<T extends { kind: string }>(links: readonly T[], hidden: readonly string[]): { link: T; index: number }[] {
  return links.map((link, index) => ({ link, index })).filter(({ link }) => !hidden.includes(link.kind));
}
