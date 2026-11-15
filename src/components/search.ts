import type { Model } from '../data/model';

export interface SearchHit {
  path: string;
  label: string;
  detail: string;
}

const isNumber = (w: string) => /^\d+$/.test(w);
const tokens = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Match components against a free-text query. Every word must match.
 * A number picks an instance ("tray 7", "gpu 2") unless it is part of the
 * component's own name ("nvlink 6", "bluefield 4"). Hits come in data order,
 * so rack units appear top to bottom.
 */
export function search(model: Model, query: string, limit = 12): SearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits: SearchHit[] = [];

  for (const c of model.topology.components) {
    if (c.id === 'rack') continue;
    const haystack = `${c.name} ${c.id} ${c.type} ${c.networks.join(' ')}`.toLowerCase();
    const nameTokens = new Set(tokens(`${c.name} ${c.id}`));
    const indexNumbers = words.filter((w) => isNumber(w) && !nameTokens.has(w));
    const otherWords = words.filter((w) => !indexNumbers.includes(w));
    if (!otherWords.every((w) => haystack.includes(w))) continue;
    const parent = c.parent && c.parent !== 'rack' ? model.getComponent(c.parent)?.name : undefined;
    const base = model.pathForComponent(c.id);

    if (indexNumbers.length === 0) {
      hits.push({ path: base, label: c.name, detail: parent ? `in ${parent}` : c.type.replace(/-/g, ' ') });
    } else if (indexNumbers.length === 1 && otherWords.length > 0) {
      const path = `${base}.${Number(indexNumbers[0])}`;
      if (model.parsePath(path) === null) continue;
      hits.push({
        path,
        label: `${c.name} ${Number(indexNumbers[0])}`,
        detail: parent ? `in ${parent}` : 'rack unit',
      });
    }
  }
  const seen = new Set<string>();
  return hits.filter((h) => !seen.has(h.path) && seen.add(h.path)).slice(0, limit);
}
