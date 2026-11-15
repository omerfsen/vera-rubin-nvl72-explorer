import { model } from '../data';
import type { Source } from '../data/types';
import { useExplorer } from '../state/store';
import { Credits } from './Credits';

interface Item {
  where: string;
  path: string;
  note: string;
}

/** Every assumed fact in the data, with where it sits and why. */
function assumedItems(): Item[] {
  const t = model.topology;
  const items: Item[] = [];
  for (const c of t.components) {
    const path = model.pathForComponent(c.id);
    if (c.assumed) items.push({ where: c.name, path, note: c.note ?? '' });
    for (const s of c.specs) if (s.assumed) items.push({ where: `${c.name}: ${s.label}`, path, note: s.note ?? '' });
  }
  for (const x of t.connections) if (x.assumed) items.push({ where: x.description, path: model.pathForComponent(x.from), note: x.note ?? '' });
  for (const [id, h] of Object.entries(t.rackLayout.heightsRU ?? {}))
    if (h.assumed) items.push({ where: `Height of ${model.getComponent(id)?.name ?? id}`, path: id, note: h.note ?? '' });
  if (t.rackLayout.numbering?.assumed) items.push({ where: 'Tray numbering', path: '', note: t.rackLayout.numbering.note ?? '' });
  for (const [id, l] of Object.entries(t.trayLayouts ?? {})) {
    if (l.assumed) items.push({ where: `Layout of the ${model.getComponent(id)?.name ?? id}`, path: id, note: l.note ?? '' });
    for (const k of l.links ?? []) if (k.assumed) items.push({ where: `${k.kind} link in the ${model.getComponent(id)?.name ?? id}`, path: id, note: k.note ?? '' });
  }
  if (t.rearLayout?.assumed) items.push({ where: 'Rear layout', path: '', note: t.rearLayout.note ?? '' });
  return items;
}

/** Readings where NVIDIA's figures and tables disagree, from the data. */
function conflicts(): Item[] {
  return model.topology.connections
    .filter((x) => x.alternative)
    .map((x) => ({ where: x.description, path: model.pathForComponent(x.from), note: x.note ?? '' }));
}

function countBy(urlPart: string): number {
  const seen: Source[] = [];
  const t = model.topology;
  const add = (s?: Source) => s && seen.push(s);
  for (const c of t.components) {
    add(c.source);
    c.specs.forEach((s) => add(s.source));
    c.textSources?.forEach(add);
  }
  t.connections.forEach((x) => add(x.source));
  t.pcieDevices?.forEach((x) => add(x.source));
  t.procedures?.forEach((p) => p.steps.forEach((s) => add(s.source)));
  return seen.filter((s) => s.url.includes(urlPart)).length;
}

export function SourcesPage() {
  const setPage = useExplorer((s) => s.setPage);
  const select = useExplorer((s) => s.select);
  const meta = model.topology.meta;
  const base = import.meta.env.BASE_URL;
  const go = (path: string) => {
    setPage('');
    select(path);
  };
  const assumed = assumedItems();
  const questions = model.topology.openQuestions ?? [];
  const conflict = conflicts();
  return (
    <article className="sources-page" aria-labelledby="sources-title">
      <button type="button" className="toggle" onClick={() => setPage('')}>
        ← Back to the rack
      </button>
      <h2 id="sources-title">Sources and open questions</h2>
      <p>
        Every fact in this explorer links to the section of NVIDIA's documentation it comes from. Anything the documents
        do not state is marked <span className="assumed">assumed</span> with a reason, and places where NVIDIA's figures
        and tables disagree are kept as conflicts rather than resolved.
      </p>
      <h3>Documents</h3>
      <ul className="plain">
        <li>
          {meta.document.title}, {meta.document.date}:{' '}
          <a href={meta.document.urls[1] ?? meta.document.urls[0]} target="_blank" rel="noopener noreferrer">
            HTML
          </a>{' '}
          ·{' '}
          <a href={meta.document.urls[0]} target="_blank" rel="noopener noreferrer">
            PDF
          </a>{' '}
          <span className="muted">({countBy('dgxvr-user-guide')} citations)</span>
        </li>
        {meta.serviceManual && (
          <li>
            {meta.serviceManual.title}, {meta.serviceManual.date}:{' '}
            <a href={meta.serviceManual.urls[1] ?? meta.serviceManual.urls[0]} target="_blank" rel="noopener noreferrer">
              HTML
            </a>{' '}
            ·{' '}
            <a href={meta.serviceManual.urls[0]} target="_blank" rel="noopener noreferrer">
              PDF
            </a>{' '}
            <span className="muted">({countBy('dgxvr-service-manual')} citations)</span>
          </li>
        )}
      </ul>
      <h3>Conflicts in NVIDIA's documents ({questions.filter((q) => q.kind === 'conflict').length})</h3>
      <ul className="plain">
        {questions
          .filter((q) => q.kind === 'conflict')
          .map((q) => (
            <li key={q.id}>
              <button type="button" className="link-button" onClick={() => go(model.pathForComponent(q.components[0] ?? 'rack'))}>
                {q.title}
              </button>
              <div className="note">{q.summary}</div>
            </li>
          ))}
      </ul>
      <h3>Gaps: what the documents do not say ({questions.filter((q) => q.kind === 'gap').length})</h3>
      <ul className="plain">
        {questions
          .filter((q) => q.kind === 'gap')
          .map((q) => (
            <li key={q.id}>
              <strong>{q.title}.</strong> <span className="note">{q.summary}</span>
            </li>
          ))}
      </ul>
      <p className="note">
        The same list, with quotes from each document, is in{' '}
        <a href={questions[0]?.details} target="_blank" rel="noopener noreferrer">
          OPEN_QUESTIONS.md
        </a>
        . {conflict.length} conflicting reading{conflict.length === 1 ? ' is' : 's are'} also kept in the data and drawn
        in the conflict colour in the network overlay.
      </p>
      <h3>Assumed ({assumed.length})</h3>
      <ul className="plain">
        {assumed.map((a, i) => (
          <li key={`${a.where}-${i}`}>
            <button type="button" className="link-button" onClick={() => go(a.path)}>
              {a.where}
            </button>
            <div className="note">{a.note}</div>
          </li>
        ))}
      </ul>
      <h3>About</h3>
      <p>
        <Credits />. Licensed under Apache 2.0.
      </p>
      <h3>The data</h3>
      <p>
        Everything the explorer shows comes from one JSON file, checked against a JSON Schema. Download both to reuse
        them:{' '}
        <a href={`${base}data/nvl72-topology.json`} download>
          nvl72-topology.json
        </a>{' '}
        ·{' '}
        <a href={`${base}data/nvl72-topology.schema.json`} download>
          schema
        </a>
        . Taken from the documents on {meta.retrieved}.
      </p>
    </article>
  );
}
