import type { Model } from '../data/model';
import { i18nFor, type I18n } from '../i18n';

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
 * so rack units appear top to bottom. Names match in the chosen language
 * and in English, and hits are labelled in the chosen language.
 */
export function search(model: Model, query: string, limit = 12, i18n: I18n = i18nFor('en')): SearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits: SearchHit[] = [];

  for (const c of model.topology.components) {
    if (c.id === 'rack') continue;
    const name = i18n.name(c.id);
    const haystack = `${name} ${c.name} ${c.id} ${c.type} ${i18n.typeName(c.type)} ${c.networks.join(' ')}`.toLowerCase();
    const nameTokens = new Set(tokens(`${name} ${c.name} ${c.id}`));
    const indexNumbers = words.filter((w) => isNumber(w) && !nameTokens.has(w));
    const otherWords = words.filter((w) => !indexNumbers.includes(w));
    if (!otherWords.every((w) => haystack.includes(w))) continue;
    const parent = c.parent && c.parent !== 'rack' ? i18n.name(c.parent) : undefined;
    const base = model.pathForComponent(c.id);

    if (indexNumbers.length === 0) {
      hits.push({ path: base, label: name, detail: parent ? i18n.t('search.in', { parent }) : i18n.typeName(c.type) });
    } else if (indexNumbers.length === 1 && otherWords.length > 0) {
      const path = `${base}.${Number(indexNumbers[0])}`;
      if (model.parsePath(path) === null) continue;
      hits.push({
        path,
        label: `${name} ${Number(indexNumbers[0])}`,
        detail: parent ? i18n.t('search.in', { parent }) : i18n.t('search.rackUnit'),
      });
    }
  }
  // Host names from Table 2.4: a PCIe bus, interface or RDMA device ("mlx5_4", "enP3p1s0f0np0", "0003:01").
  // Only for queries that look like one: NVIDIA's labels count from 0 (GPU_2 is this app's GPU 3), so a
  // plain "gpu 2" must not match them.
  const hostQuery = words.some((w) => /[:_/]/.test(w) || /^(mlx5|enp)/.test(w));
  for (const r of hostQuery ? (model.topology.pcieDevices ?? []) : []) {
    const hay = `${r.label} ${r.bus} ${r.interface ?? ''} ${r.rdma ?? ''}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    const path = model.pathForComponent(r.component) + (r.index ? `.${r.index}` : '');
    if (model.parsePath(path) === null) continue;
    hits.unshift({ path, label: [r.label, r.rdma, r.interface].filter(Boolean).join(' · '), detail: r.bus });
  }
  const seen = new Set<string>();
  return hits.filter((h) => !seen.has(h.path) && seen.add(h.path)).slice(0, limit);
}
