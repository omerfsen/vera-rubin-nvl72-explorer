import { model } from '../data';
import type { Source } from '../data/types';
import { useExplorer } from '../state/store';
import { Credits } from './Credits';
import { GlossaryList } from './Glossary';
import { useI18n, type I18n } from '../i18n';
import { Rich } from '../i18n/Rich';

interface Item {
  where: string;
  path: string;
  note: string;
}

/** Every assumed fact in the data, with where it sits and why. */
function assumedItems(i18n: I18n): Item[] {
  const t = model.topology;
  const { t: ui } = i18n;
  const items: Item[] = [];
  for (const c of t.components) {
    const path = model.pathForComponent(c.id);
    const name = i18n.name(c.id);
    if (c.assumed) items.push({ where: name, path, note: i18n.component(c, 'note') ?? '' });
    for (const s of c.specs)
      if (s.assumed)
        items.push({
          where: ui('sources.specWhere', { name, label: i18n.specLabel(s.label) }),
          path,
          note: i18n.specNote(c.id, s.label, s.note) ?? '',
        });
  }
  for (const x of t.connections)
    if (x.assumed)
      items.push({
        where: i18n.connection(x.id, 'description', x.description),
        path: model.pathForComponent(x.from),
        note: i18n.connection(x.id, 'note', x.note) ?? '',
      });
  for (const [id, h] of Object.entries(t.rackLayout.heightsRU ?? {}))
    if (h.assumed) items.push({ where: ui('sources.heightOf', { name: i18n.name(id) }), path: id, note: i18n.heightNote(id, h.note) ?? '' });
  if (t.rackLayout.numbering?.assumed)
    items.push({ where: ui('sources.trayNumbering'), path: '', note: i18n.numberingNote(t.rackLayout.numbering.note) ?? '' });
  for (const [id, l] of Object.entries(t.trayLayouts ?? {})) {
    if (l.assumed) items.push({ where: ui('sources.layoutOf', { name: i18n.name(id) }), path: id, note: i18n.trayNote(id, l.note) ?? '' });
    (l.links ?? []).forEach((k, i) => {
      if (k.assumed)
        items.push({
          where: ui('sources.linkIn', { kind: k.kind, name: i18n.name(id) }),
          path: id,
          note: i18n.linkNote(id, i, k.note) ?? '',
        });
    });
  }
  if (t.rearLayout?.assumed) items.push({ where: ui('sources.rearLayout'), path: '', note: i18n.rearNote(t.rearLayout.note) ?? '' });
  return items;
}

/** Readings where NVIDIA's figures and tables disagree, from the data. */
function conflicts(i18n: I18n): Item[] {
  return model.topology.connections
    .filter((x) => x.alternative)
    .map((x) => ({
      where: i18n.connection(x.id, 'description', x.description),
      path: model.pathForComponent(x.from),
      note: i18n.connection(x.id, 'note', x.note) ?? '',
    }));
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
  t.glossary?.forEach((g) => add(g.source));
  return seen.filter((s) => s.url.includes(urlPart)).length;
}

export function SourcesPage() {
  const setPage = useExplorer((s) => s.setPage);
  const select = useExplorer((s) => s.select);
  const i18n = useI18n();
  const { t } = i18n;
  const meta = model.topology.meta;
  const base = import.meta.env.BASE_URL;
  const go = (path: string) => {
    setPage('');
    select(path);
  };
  const assumed = assumedItems(i18n);
  const questions = model.topology.openQuestions ?? [];
  const conflict = conflicts(i18n);
  return (
    <article className="sources-page" aria-labelledby="sources-title">
      <button type="button" className="toggle" onClick={() => setPage('')}>
        {t('sources.back')}
      </button>
      <h2 id="sources-title">{t('sources.title')}</h2>
      {i18n.lang !== 'en' && (
        <p className="note translated-notice" lang={i18n.lang}>
          {t('language.translated')}
        </p>
      )}
      <p>
        <Rich text={t('sources.intro')} parts={{ assumed: <span className="assumed">{t('panel.assumed')}</span> }} />
      </p>
      <h3>{t('sources.documents')}</h3>
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
          <span className="muted">{t('sources.citations', { count: countBy('dgxvr-user-guide') })}</span>
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
            <span className="muted">{t('sources.citations', { count: countBy('dgxvr-service-manual') })}</span>
          </li>
        )}
      </ul>
      <p>
        <button type="button" className="link-button" onClick={() => setPage('changes')}>
          {t('sources.whatChanged')}
        </button>
      </p>
      <h3>{t('sources.conflicts', { count: questions.filter((q) => q.kind === 'conflict').length })}</h3>
      <ul className="plain">
        {questions
          .filter((q) => q.kind === 'conflict')
          .map((q) => (
            <li key={q.id}>
              <button type="button" className="link-button" onClick={() => go(model.pathForComponent(q.components[0] ?? 'rack'))}>
                {i18n.question(q.id, 'title', q.title)}
              </button>
              <div className="note">{i18n.question(q.id, 'summary', q.summary)}</div>
            </li>
          ))}
      </ul>
      <h3>{t('sources.gaps', { count: questions.filter((q) => q.kind === 'gap').length })}</h3>
      <ul className="plain">
        {questions
          .filter((q) => q.kind === 'gap')
          .map((q) => (
            <li key={q.id}>
              <strong>{i18n.question(q.id, 'title', q.title)}.</strong>{' '}
              <span className="note">{i18n.question(q.id, 'summary', q.summary)}</span>
            </li>
          ))}
      </ul>
      <p className="note">
        <Rich
          text={t('sources.sameList')}
          parts={{
            file: (
              <a href={questions[0]?.details} target="_blank" rel="noopener noreferrer">
                OPEN_QUESTIONS.md
              </a>
            ),
          }}
        />{' '}
        {t(conflict.length === 1 ? 'sources.conflictingOne' : 'sources.conflictingMany', { count: conflict.length })}
      </p>
      <h3>{t('sources.assumed', { count: assumed.length })}</h3>
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
      <GlossaryList />
      <h3>{t('sources.about')}</h3>
      <p>
        <Credits />. {t('sources.license')}
      </p>
      <h3>{t('sources.data')}</h3>
      <p>
        <Rich
          text={t('sources.dataText', { date: meta.retrieved })}
          parts={{
            json: (
              <a href={`${base}data/nvl72-topology.json`} download>
                nvl72-topology.json
              </a>
            ),
            schema: (
              <a href={`${base}data/nvl72-topology.schema.json`} download>
                {t('sources.schema')}
              </a>
            ),
          }}
        />{' '}
        <Rich text={t('sources.translations')} parts={{ files: <code>data/i18n/</code> }} />
      </p>
    </article>
  );
}
