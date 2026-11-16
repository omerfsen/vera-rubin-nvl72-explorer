import { useId } from 'react';
import display from '../../data/display.json';
import { model } from '../data';
import { rackTotals } from '../data/totals';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';

const ROWS = rackTotals(model, display.rackTotals.types);
const MAX = Math.max(1, ...ROWS.map((r) => r.total ?? 0));

/**
 * "How many in the rack": a bar per component type with its rack-wide total.
 * A table underneath, so screen readers read the numbers; the bars are drawn
 * with plain HTML on one linear scale, each labelled with its value.
 */
export function RackTotals({ level = 3 }: { level?: 2 | 3 }) {
  const select = useExplorer((s) => s.select);
  const i18n = useI18n();
  const { t } = i18n;
  const titleId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <section className="rack-totals" aria-labelledby={titleId}>
      <Heading id={titleId}>{t('rackTotals.title')}</Heading>
      <table className="totals-chart">
        <caption className="muted small">{t('rackTotals.caption')}</caption>
        <colgroup>
          <col className="totals-col-name" />
          <col />
          <col className="totals-col-source" />
        </colgroup>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t('rackTotals.part')}</th>
            <th scope="col">{t('rackTotals.inRack')}</th>
            <th scope="col">{t('rackTotals.source')}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const id = r.component.id;
            const name = i18n.name(id);
            const open = () => select(model.pathForComponent(id));
            const note = r.assumedBy ? i18n.component(r.assumedBy, 'note') : undefined;
            return (
              <tr key={id} data-component={id}>
                <th scope="row">
                  <button type="button" className="link-button" onClick={open}>
                    {name}
                  </button>
                </th>
                <td className="totals-value">
                  {r.total === null ? (
                    <span className="muted">{t('rackTotals.notStated')}</span>
                  ) : (
                    <span className="totals-bar-row">
                      <span
                        className="totals-bar"
                        aria-hidden="true"
                        style={{ width: `calc((100% - 4.5ch) * ${r.total / MAX})` }}
                        onClick={open}
                      />
                      <span className="totals-number">{r.total}</span>
                    </span>
                  )}
                  {r.assumed && (
                    <>
                      {' '}
                      <span className="assumed" title={note}>
                        {t('panel.assumed')}
                      </span>
                    </>
                  )}
                </td>
                <td className="totals-source">
                  <a
                    href={r.component.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={r.component.source.section}
                    aria-label={t('rackTotals.sourceFor', { name, section: r.component.source.section })}
                  >
                    <span aria-hidden="true">↗</span>
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
