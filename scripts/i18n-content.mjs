// Builds the "content" part of data/i18n/en.json from data/nvl72-topology.json:
// every descriptive text the explorer shows, keyed by id, so tr.json and
// zh.json can translate it. Run `npm run i18n:en` after editing the data;
// tests/i18n.test.ts fails if en.json has drifted. Facts stay in the data
// file; ids, commands, spec values and source titles are never copied here.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Sets o[k] only for a non-empty value. */
function put(o, k, v) {
  if (v === undefined || v === null || v === '') return;
  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return;
  o[k] = v;
}

export function computeContent(topology) {
  const t = topology;
  const out = {};

  const components = {};
  const specLabels = {};
  for (const c of t.components) {
    const e = { name: c.name };
    put(e, 'description', c.description);
    put(e, 'function', c.function);
    put(e, 'note', c.note);
    const specNotes = {};
    for (const s of c.specs) {
      specLabels[s.label] = s.label;
      put(specNotes, s.label, s.note);
    }
    put(e, 'specNotes', specNotes);
    components[c.id] = e;
  }
  out.components = components;
  out.specLabels = Object.fromEntries(Object.keys(specLabels).sort().map((k) => [k, k]));

  out.networks = Object.fromEntries(
    t.networks.map((n) => {
      const e = { description: n.description };
      put(e, 'note', n.note);
      return [n.id, e];
    }),
  );

  out.connections = Object.fromEntries(
    t.connections.map((x) => {
      const e = { description: x.description };
      put(e, 'note', x.note);
      return [x.id, e];
    }),
  );

  const pcieNotes = {};
  for (const r of t.pcieDevices ?? []) if (r.note) pcieNotes[r.note] = r.note;
  put(out, 'pcieNotes', pcieNotes);

  put(
    out,
    'procedures',
    Object.fromEntries((t.procedures ?? []).map((p) => [p.id, { title: p.title, steps: p.steps.map((s) => s.text) }])),
  );

  put(out, 'openQuestions', Object.fromEntries((t.openQuestions ?? []).map((q) => [q.id, { title: q.title, summary: q.summary }])));

  // Software names are product names (NVIDIA Mission Control, DCGM, ...) and stay in English.
  put(
    out,
    'software',
    Object.fromEntries(
      (t.software ?? []).map((s) => {
        const e = { description: s.description };
        put(e, 'note', s.note);
        return [s.id, e];
      }),
    ),
  );

  put(out, 'safety', Object.fromEntries((t.safety ?? []).map((s) => [s.id, { title: s.title, text: s.text }])));

  // The command text itself is never translated.
  put(
    out,
    'commands',
    Object.fromEntries(
      (t.commands ?? []).map((c) => {
        const e = { group: c.group, title: c.title, purpose: c.purpose };
        put(e, 'note', c.note);
        return [c.id, e];
      }),
    ),
  );

  if (t.commandNotes) out.commandNotes = { usage: t.commandNotes.usage, factoryReset: t.commandNotes.factoryReset };

  if (t.nvlinkFabric) {
    const e = { description: t.nvlinkFabric.description };
    put(e, 'note', t.nvlinkFabric.note);
    out.nvlinkFabric = e;
  }

  const rack = {};
  put(rack, 'note', t.rackLayout.note);
  put(rack, 'numbering', t.rackLayout.numbering?.note);
  const overrides = {};
  for (const [id, o] of Object.entries(t.rackLayout.numbering?.overrides ?? {})) put(overrides, id, o.note);
  put(rack, 'overrides', overrides);
  const heights = {};
  for (const [id, h] of Object.entries(t.rackLayout.heightsRU ?? {})) put(heights, id, h.note);
  put(rack, 'heights', heights);
  out.rackLayout = rack;

  const trays = {};
  for (const [id, l] of Object.entries(t.trayLayouts ?? {})) {
    const e = {};
    put(e, 'note', l.note);
    put(e, 'notPlaced', Object.fromEntries((l.notPlaced ?? []).map((n) => [n.component, n.reason])));
    put(e, 'points', Object.fromEntries((l.points ?? []).map((p) => [p.id, p.label])));
    const links = {};
    (l.links ?? []).forEach((k, i) => put(links, String(i), k.note));
    put(e, 'links', links);
    put(trays, id, e);
  }
  put(out, 'trayLayouts', trays);

  if (t.rearLayout?.note) out.rearLayout = { note: t.rearLayout.note };

  // The term itself (BMC, NVLink) stays as it is; its expansion and definition are translated.
  put(
    out,
    'glossary',
    Object.fromEntries(
      (t.glossary ?? []).map((g) => {
        const e = {};
        put(e, 'expansion', g.expansion);
        put(e, 'definition', g.definition);
        return [g.id, e];
      }),
    ),
  );
  return out;
}

/** Rewrites the content part of en.json, keeping its ui part. */
function main() {
  const dataPath = fileURLToPath(new URL('../data/nvl72-topology.json', import.meta.url));
  const enPath = fileURLToPath(new URL('../data/i18n/en.json', import.meta.url));
  const t = JSON.parse(readFileSync(dataPath, 'utf8'));
  let en = {};
  try {
    en = JSON.parse(readFileSync(enPath, 'utf8'));
  } catch {
    en = {};
  }
  const content = computeContent(t);
  writeFileSync(enPath, `${JSON.stringify({ ui: en.ui ?? {}, content }, null, 2)}\n`);
  let strings = 0;
  const count = (v) => (typeof v === 'string' ? strings++ : Object.values(v).forEach(count));
  count(content);
  console.log(`i18n: ${strings} content strings in data/i18n/en.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
