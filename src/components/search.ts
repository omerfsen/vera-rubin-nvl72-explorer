import type { Model } from '../data/model';
import { i18nFor, type I18n } from '../i18n';

export interface SearchHit {
  path: string;
  label: string;
  detail: string;
}

const isNumber = (w: string) => /^\d+$/.test(w);
const tokens = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
/** Letters and digits only, so "Bay_B_R_E1.s_Top" matches "Bay_B_R E1.s_Top". */
const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Which query numbers pick an instance rather than belong to the name. A
 * number not in the name is an index. A number that is in the name is an
 * index too when the query has it more often than the name ("nvlink 6 switch
 * tray 6"), or when it ends the query after a word other than the one before
 * it in the name ("switch tray 6", but not "nvlink 6").
 */
function indexWords(words: string[], name: string[]): string[] {
  const out: string[] = [];
  words.forEach((w, i) => {
    if (!isNumber(w) || out.includes(w)) return;
    if (!name.includes(w)) return void out.push(w);
    const inQuery = words.filter((x) => x === w).length;
    const inName = name.filter((x) => x === w).length;
    if (inQuery > inName) return void out.push(w);
    const last = i === words.length - 1;
    const before = words[i - 1];
    if (last && i > 0 && before !== undefined && !name.some((x, k) => x === w && name[k - 1] === before)) out.push(w);
  });
  return out;
}

/**
 * Match components against a free-text query. Every word must match.
 * A number picks an instance ("tray 7", "gpu 2") unless it is part of the
 * component's own name ("nvlink 6", "bluefield 4"). Numbers are the ones
 * shown in the app, so GPUs and CPUs count from 0 as NVIDIA's labels do.
 * Hits come in data order, so rack units appear top to bottom. Names match
 * in the chosen language and in English, network names only as whole words,
 * and hits are labelled in the chosen language.
 */
export function search(model: Model, query: string, limit = 12, i18n: I18n = i18nFor('en')): SearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits: SearchHit[] = [];

  for (const c of model.topology.components) {
    if (c.id === 'rack') continue;
    const name = i18n.name(c.id);
    const haystack = `${name} ${c.name} ${c.id} ${c.type} ${i18n.typeName(c.type)}`.toLowerCase();
    const networks = new Set(c.networks);
    const hayTokens = tokens(haystack);
    // Latin words match the start of a word ("tor" finds the ToR switch, not "connector");
    // other scripts, and words with punctuation ("e1.s"), match anywhere.
    const matches = (w: string) =>
      /^[a-z0-9]+$/.test(w) ? hayTokens.some((t) => t.startsWith(w)) : haystack.includes(w);
    const nameTokens = tokens(`${name} ${c.name}`);
    const indexNumbers = indexWords(words, nameTokens);
    const otherWords = [...words];
    for (const n of indexNumbers) otherWords.splice(otherWords.lastIndexOf(n), 1);
    if (!otherWords.every((w) => matches(w) || networks.has(w))) continue;
    const parent = c.parent && c.parent !== 'rack' ? i18n.name(c.parent) : undefined;
    const base = model.pathForComponent(c.id);

    if (indexNumbers.length === 0) {
      hits.push({ path: base, label: name, detail: parent ? i18n.t('search.in', { parent }) : i18n.typeName(c.type) });
    } else if (indexNumbers.length === 1 && otherWords.length > 0) {
      const index = model.pathIndex(c.id, Number(indexNumbers[0]));
      const path = `${base}.${index}`;
      if (index < 1 || model.parsePath(path) === null) continue;
      hits.push({
        path,
        label: i18n.segmentLabel({ id: c.id, index }),
        detail: parent ? i18n.t('search.in', { parent }) : i18n.t('search.rackUnit'),
      });
    }
  }
  // Host names from Table 2.4 and the spellings its figures print: a PCIe bus, interface or RDMA
  // device ("mlx5_4", "enP3p1s0f0np0", "0003:01", "c7/c3_1"). Only for queries that look like one,
  // so a plain "gpu 2" does not also match the row labelled GPU_2.
  const hostQuery = words.some((w) => /[:_/]/.test(w) || /^(mlx5|enp)/.test(w));
  for (const r of hostQuery ? (model.topology.pcieDevices ?? []) : []) {
    const hay = squash(`${r.label} ${(r.aliases ?? []).join(' ')} ${r.bus} ${r.interface ?? ''} ${r.rdma ?? ''}`);
    if (!words.every((w) => hay.includes(squash(w)))) continue;
    const path = model.pathForComponent(r.component) + (r.index ? `.${r.index}` : '');
    if (model.parsePath(path) === null) continue;
    hits.unshift({ path, label: [r.label, r.rdma, r.interface].filter(Boolean).join(' · '), detail: r.bus });
  }
  // One row per part and bus: two Table 2.4 rows can name the same port on different buses.
  const seen = new Set<string>();
  return hits.filter((h) => !seen.has(`${h.path}|${h.detail}`) && seen.add(`${h.path}|${h.detail}`)).slice(0, limit);
}
