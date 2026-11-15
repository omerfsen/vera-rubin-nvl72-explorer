import type { Model } from '../data/model';

export interface SearchHit {
  path: string;
  label: string;
  detail: string;
}

/**
 * Match rack units ("compute tray 7") and component types ("gpu", "bluefield",
 * "storagenet") against a free-text query. Every word must match.
 */
export function search(model: Model, query: string, limit = 12): SearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matches = (text: string) => words.every((w) => text.includes(w));
  const hits: SearchHit[] = [];

  for (const c of model.topology.components) {
    if (c.id === 'rack') continue;
    const nets = c.networks.join(' ');
    const haystack = `${c.name} ${c.id} ${c.type} ${nets}`.toLowerCase();
    if (matches(haystack)) {
      const parent = c.parent ? model.getComponent(c.parent)?.name : undefined;
      hits.push({
        path: model.pathForComponent(c.id),
        label: c.name,
        detail: parent && c.parent !== 'rack' ? `in ${parent}` : c.type.replace(/-/g, ' '),
      });
    }
  }
  const numbers = words.filter((w) => /^\d+$/.test(w)).map(Number);
  const text = words.filter((w) => !/^\d+$/.test(w));
  if (numbers.length > 0) {
    for (const u of model.rackUnits) {
      const c = model.getComponent(u.componentId);
      const name = c?.name ?? u.componentId;
      const nameWords = `${name} ${u.componentId}`.toLowerCase();
      const numbersOk = numbers.every((n) => n === u.index || nameWords.split(/[\s-]+/).includes(String(n)));
      if (numbersOk && numbers.includes(u.index) && text.every((w) => nameWords.includes(w))) {
        hits.unshift({ path: u.key, label: `${name} ${u.index}`, detail: 'rack unit' });
      }
    }
  }
  return hits.slice(0, limit);
}
