// Builds each component's `references` in data/nvl72-topology.json: every
// section of NVIDIA's documents that says something about it, with the HTML
// link, the PDF page and any figure. Run `npm run data:refs` after editing
// the data; tests/references.test.ts fails if the stored list has drifted.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FIGURE_BASE = 'https://docs.nvidia.com/dgx/dgxvr-user-guide/_images/';

/** "1.2 Compute Trays, Fig. 4 (...)" -> "1.2"; "Service Manual 3.3 Replace ..." -> "3.3"; chapter intros -> "ch1". */
function sectionNumber(section) {
  const m = /^(?:Service Manual )?(\d+\.\d+(?:\.\d+)?)/.exec(section);
  if (m) return m[1];
  const ch = /^Chapter (\d+)/.exec(section);
  return ch ? `ch${ch[1]}` : null;
}

/** Section title without figure or table detail: "1.2 Compute Trays, Fig. 4 (...)" -> "1.2 Compute Trays". */
function sectionTitle(section) {
  return section
    .replace(/^Service Manual /, '')
    .split(',')[0]
    .replace(/\s*\([^)]*\)$/, '')
    .trim();
}

function documentOf(url) {
  return url.includes('/dgxvr-service-manual/') ? 'service-manual' : 'user-guide';
}

export function computeReferences(topology) {
  const t = topology;
  const pdfs = {
    'user-guide': { url: t.meta.document.urls.find((u) => u.endsWith('.pdf')), pages: t.meta.document.pdfPages ?? {} },
    'service-manual': t.meta.serviceManual
      ? { url: t.meta.serviceManual.urls.find((u) => u.endsWith('.pdf')), pages: t.meta.serviceManual.pdfPages ?? {} }
      : null,
  };
  const byId = new Map(t.components.map((c) => [c.id, c]));
  const ancestorsOf = (id) => {
    const out = [];
    let c = byId.get(id);
    while (c && c.parent) {
      out.unshift(c.parent);
      c = byId.get(c.parent);
    }
    return out;
  };
  const sources = new Map(t.components.map((c) => [c.id, []]));
  const add = (id, s) => s && sources.get(id)?.push(s);

  for (const c of t.components) {
    add(c.id, c.source);
    (c.textSources ?? []).forEach((s) => add(c.id, s));
    c.specs.forEach((s) => add(c.id, s.source));
  }
  for (const x of t.connections) {
    add(x.from, x.source);
    if (x.to) add(x.to, x.source);
  }
  for (const r of t.pcieDevices ?? []) add(r.component, r.source);
  for (const p of t.procedures ?? []) p.steps.forEach((s) => add(p.component, s.source));
  for (const [trayId, l] of Object.entries(t.trayLayouts ?? {})) {
    const placed = new Set(l.slots.map((s) => s.component));
    for (const id of placed) {
      add(id, l.source);
      (l.sources ?? []).forEach((s) => add(id, s));
    }
    for (const k of l.links ?? []) {
      for (const end of [k.from, k.to]) if (end.component) add(end.component, k.source);
    }
    add(trayId, l.source);
  }
  for (const g of t.rackLayout.groups) add(g.component, t.rackLayout.source);
  for (const [id, h] of Object.entries(t.rackLayout.heightsRU ?? {})) add(id, h.source);
  for (const [id, o] of Object.entries(t.rackLayout.numbering?.overrides ?? {})) add(id, o.source);
  for (const p of t.rearLayout?.parts ?? []) add(p.component, t.rearLayout.source);
  for (const u of t.rearLayout?.unitConnectors ?? []) add(u.component, t.rearLayout.source);
  for (const s of t.software ?? []) s.runsOn.forEach((id) => add(id, s.source));
  for (const c of t.commands ?? []) c.appliesTo.forEach((id) => add(id, c.source));
  for (const s of t.safety ?? []) s.components.forEach((id) => add(id, s.source));
  if (t.nvlinkFabric) {
    for (const id of [...t.nvlinkFabric.endpoints, t.nvlinkFabric.through]) {
      add(id, t.nvlinkFabric.source);
      (t.nvlinkFabric.textSources ?? []).forEach((s) => add(id, s));
    }
  }

  const result = {};
  for (const c of t.components) {
    const groups = new Map();
    for (const s of sources.get(c.id)) {
      const doc = documentOf(s.url);
      const number = sectionNumber(s.section) ?? sectionTitle(s.section);
      const key = `${doc}|${number}`;
      if (!groups.has(key)) {
        const pdf = pdfs[doc];
        // Deep headings (6.4.1.1.2) fall back to the nearest parent with a known page.
        let page;
        for (let n = number; n && page === undefined; n = n.includes('.') ? n.slice(0, n.lastIndexOf('.')) : '') page = pdf?.pages[n];
        groups.set(key, {
          document: doc,
          section: sectionTitle(s.section),
          html: s.url,
          ...(pdf?.url && page ? { pdf: `${pdf.url}#page=${page}` } : {}),
          figures: new Set(),
        });
      }
      if (s.figure) groups.get(key).figures.add(`${FIGURE_BASE}${s.figure}`);
    }
    const order = (r) => (r.document === 'user-guide' ? 0 : 1);
    const num = (r) => (sectionNumber(r.section) ?? '99').replace('ch', '0.').split('.').map(Number);
    result[c.id] = [...groups.values()]
      .map(({ figures, ...r }) => (figures.size ? { ...r, figures: [...figures].sort() } : r))
      .sort((a, b) => order(a) - order(b) || num(a)[0] - num(b)[0] || num(a)[1] - num(b)[1]);
  }
  return result;
}

/** Writes the computed references into the data file, keeping the key order. */
function main() {
  const path = fileURLToPath(new URL('../data/nvl72-topology.json', import.meta.url));
  const t = JSON.parse(readFileSync(path, 'utf8'));
  const refs = computeReferences(t);
  t.components = t.components.map((c) => {
    const { references: _old, ...rest } = c;
    const out = {};
    for (const [k, v] of Object.entries(rest)) {
      out[k] = v;
      if (k === 'textSources' || (k === 'source' && !rest.textSources)) out.references = refs[c.id];
    }
    if (!out.references) out.references = refs[c.id];
    return out;
  });
  writeFileSync(path, `${JSON.stringify(t, null, 2)}\n`);
  const total = Object.values(refs).reduce((n, r) => n + r.length, 0);
  console.log(`references: ${total} section links across ${t.components.length} components`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
