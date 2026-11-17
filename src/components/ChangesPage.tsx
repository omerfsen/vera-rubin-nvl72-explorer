import fingerprints from '../../data/doc-fingerprints.json';
import site from '../../data/site.json';
import { model } from '../data';
import { sortedChangelog } from '../data/changelog';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';

/**
 * What changed in NVIDIA's documents and how the data followed: the changelog
 * from the data, newest first, and the fingerprint of each PDF the data was
 * built from (data/doc-fingerprints.json, which the weekly check compares).
 */
export function ChangesPage() {
  const setPage = useExplorer((s) => s.setPage);
  const i18n = useI18n();
  const { t } = i18n;
  const entries = sortedChangelog(model.topology.changelog ?? []);
  const docName = (d: string) => (d === 'app-data' ? t('changes.appData') : t(`docs.${d}`));
  return (
    <article className="sources-page changes-page" aria-labelledby="changes-title">
      <button type="button" className="toggle" onClick={() => setPage('')}>
        {t('sources.back')}
      </button>
      <h2 id="changes-title">{t('changes.title')}</h2>
      {i18n.lang !== 'en' && (
        <p className="note translated-notice" lang={i18n.lang}>
          {t('language.translated')}
        </p>
      )}
      <p>{t('changes.intro')}</p>
      <p>
        <button type="button" className="link-button" onClick={() => setPage('sources')}>
          {t('sources.title')}
        </button>
      </p>

      <h3>{t('changes.fingerprints')}</h3>
      <ul className="plain">
        {fingerprints.documents.map((d) => {
          const modified = new Date(d.lastModified);
          return (
            <li key={d.url}>
              <a href={d.url} target="_blank" rel="noopener noreferrer">
                {d.title}
              </a>
              <div className="note">
                {t('changes.fingerprint', {
                  date: Number.isNaN(modified.getTime()) ? d.lastModified : modified.toISOString().slice(0, 10),
                })}{' '}
                <code title={d.sha256}>{d.sha256.slice(0, 12)}</code>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="note">{t('changes.watch')}</p>

      <h3>{t('changes.entries', { count: entries.length })}</h3>
      <ol className="plain changes-list">
        {entries.map((e) => (
          <li key={e.id} data-document={e.document}>
            <div className="change-head">
              <time dateTime={e.date}>
                <strong>{e.date}</strong>
              </time>
              <span>{docName(e.document)}</span>
              <span className="muted">
                {t('changes.reflects', { list: e.reflects.map((r) => `${docName(r.document)} ${r.date}`).join(', ') })}
              </span>
            </div>
            <p>{i18n.change(e.id, e.summary)}</p>
            {e.reflects
              .filter((r) => r.note)
              .map((r) => (
                <p key={r.document} className="note reflects-note">
                  {i18n.changeNote(e.id, r.document, r.note!)}
                </p>
              ))}
            {e.sections.length > 0 && (
              <details open={e.sections.length <= 3}>
                <summary>{t('changes.sections', { count: e.sections.length })}</summary>
                <ul>
                  {e.sections.map((s, i) => (
                    <li key={`${s.url}-${i}`}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.section}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="note">
              {[
                e.pr !== undefined && { href: `${site.repository}/pull/${e.pr}`, label: t('changes.pr', { number: e.pr }) },
                e.issue !== undefined && { href: `${site.repository}/issues/${e.issue}`, label: t('changes.issue', { number: e.issue }) },
                e.commit !== undefined && { href: `${site.repository}/commit/${e.commit}`, label: t('changes.commit', { hash: e.commit.slice(0, 7) }) },
              ]
                .filter((x) => x !== false)
                .map((x, i) => (
                  <span key={x.href}>
                    {i > 0 && ' · '}
                    <a href={x.href} target="_blank" rel="noopener noreferrer">
                      {x.label}
                    </a>
                  </span>
                ))}
            </p>
          </li>
        ))}
      </ol>
    </article>
  );
}
