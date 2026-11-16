import { model } from '../data';
import { buildComparison, compareSide, specText, type CompareSide } from '../data/compare';
import type { Spec } from '../data/types';
import { useExplorer } from '../state/store';
import { useI18n, type I18n } from '../i18n';

function sideName(side: CompareSide, i18n: I18n): string {
  return side.segment ? i18n.segmentLabel(side.segment) : i18n.name(side.component.id);
}

/** "Compare" on the selected part: pins it as the left side. */
export function CompareStart() {
  const selected = useExplorer((s) => s.selected);
  const compare = useExplorer((s) => s.compare);
  const start = useExplorer((s) => s.startCompare);
  const i18n = useI18n();
  const side = compareSide(model, selected);
  if (selected === '' || compare !== '' || !side) return null;
  return (
    <button type="button" className="compare-start" title={i18n.t('compare.startHint', { name: sideName(side, i18n) })} onClick={() => start()}>
      {i18n.t('compare.start')}
    </button>
  );
}

function SpecCell({ spec }: { spec: Spec | undefined }) {
  const { t } = useI18n();
  if (!spec) return <td className="muted">{t('compare.none')}</td>;
  return (
    <td>
      {specText(spec)} {spec.assumed && <span className="assumed" title={spec.note}>{t('panel.assumed')}</span>}
    </td>
  );
}

/** The comparison between the pinned part (left) and the selection (right). */
export function CompareBox() {
  const compare = useExplorer((s) => s.compare);
  const selected = useExplorer((s) => s.selected);
  const select = useExplorer((s) => s.select);
  const swap = useExplorer((s) => s.swapCompare);
  const clear = useExplorer((s) => s.clearCompare);
  const stop = useExplorer((s) => s.stopCompare);
  const i18n = useI18n();
  const { t } = i18n;
  if (compare === '') return null;
  const pinned = compareSide(model, compare);
  if (!pinned) return null;
  const leftName = sideName(pinned, i18n);
  const comparison = selected === compare ? null : buildComparison(model, compare, selected);
  const differs = <span className="sr-only"> ({t('compare.differs')})</span>;

  const actions = (
    <div className="compare-actions">
      {comparison && (
        <>
          <button type="button" onClick={swap} disabled={selected === ''}>
            {t('compare.swap')}
          </button>
          <button type="button" onClick={clear}>
            {t('compare.clear')}
          </button>
        </>
      )}
      <button type="button" onClick={stop}>
        {t('compare.stop')}
      </button>
    </div>
  );

  if (!comparison) {
    return (
      <section className="compare" aria-label={t('compare.heading')}>
        <h3>{t('compare.heading')}</h3>
        <p>{t('compare.pickAnother', { name: leftName })}</p>
        {actions}
      </section>
    );
  }

  const { left, right } = comparison;
  const rightName = sideName(right, i18n);
  const count = (side: CompareSide) => (side.totalPerRack === null ? t('compare.notStated') : String(side.totalPerRack));
  const typeDiffers = left.component.type !== right.component.type;
  const countDiffers = left.totalPerRack !== right.totalPerRack;
  const networksDiffer = comparison.networks.some((n) => n.left !== n.right);
  const networkCell = (which: 'left' | 'right') => {
    const on = comparison.networks.filter((n) => n[which]);
    if (on.length === 0) return <td className="muted">{t('compare.none')}</td>;
    return (
      <td>
        <ul className="plain compare-nets">
          {on.map(({ network, left: l, right: r }) => (
            <li key={network.id}>
              {l && r ? (
                network.name
              ) : (
                <mark title={t('compare.onlyThisSide')}>
                  {network.name}
                  <span className="sr-only"> ({t('compare.onlyThisSide')})</span>
                </mark>
              )}
            </li>
          ))}
        </ul>
      </td>
    );
  };

  return (
    <section className="compare" aria-label={t('compare.aria', { left: leftName, right: rightName })}>
      <h3>{t('compare.heading')}</h3>
      <div className="table-scroll compare-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">{t('compare.part')}</span>
              </th>
              <th scope="col">
                <button type="button" className="link-button" onClick={() => select(left.path)}>
                  {leftName}
                </button>
              </th>
              <th scope="col">{rightName}</th>
            </tr>
          </thead>
          <tbody>
            <tr className={typeDiffers ? 'differs' : undefined}>
              <th scope="row">
                {t('compare.type')}
                {typeDiffers && differs}
              </th>
              <td>{i18n.typeName(left.component.type)}</td>
              <td>{i18n.typeName(right.component.type)}</td>
            </tr>
            <tr className={countDiffers ? 'differs' : undefined}>
              <th scope="row">
                {t('compare.inRack')}
                {countDiffers && differs}
              </th>
              <td>{count(left)}</td>
              <td>{count(right)}</td>
            </tr>
            {comparison.specs.length > 0 && (
              <tr className="compare-group">
                <th scope="rowgroup" colSpan={3}>
                  {t('compare.specs')}
                </th>
              </tr>
            )}
            {comparison.specs.map((row) => (
              <tr key={row.label} className={row.differs ? 'differs' : undefined}>
                <th scope="row">
                  {i18n.specLabel(row.label)}
                  {row.differs && differs}
                </th>
                <SpecCell spec={row.left} />
                <SpecCell spec={row.right} />
              </tr>
            ))}
            <tr className={networksDiffer ? 'differs' : undefined}>
              <th scope="row">
                {t('compare.networks')}
                {networksDiffer && differs}
              </th>
              {networkCell('left')}
              {networkCell('right')}
            </tr>
            <tr>
              <th scope="row">{t('compare.source')}</th>
              {[left, right].map((side) => (
                <td key={side === left ? 'l' : 'r'}>
                  <a href={side.component.source.url} target="_blank" rel="noopener noreferrer">
                    {side.component.source.section}
                  </a>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">{t('compare.legend')}</p>
      {actions}
    </section>
  );
}
