import { model } from '../data';
import { filterNetworks, filterTypes, filterUnits, isFiltering } from '../data/listFilter';
import { NETWORK_COLORS, TYPE_COLORS } from '../scenes/geometry';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';
import { RackTotals } from './RackTotals';

/**
 * The rack as a plain list, top to bottom. It is the fallback when WebGL is
 * missing, and a keyboard and screen-reader friendly way to move around.
 * `totals` also shows the rack totals chart (when there is no 3D view).
 */
export function RackList({ totals = false }: { totals?: boolean } = {}) {
  const selected = useExplorer((s) => s.selected);
  const select = useExplorer((s) => s.select);
  const i18n = useI18n();
  const { t } = i18n;
  const current = selected.split('/')[0];
  const groups = model.topology.rackLayout.groups;
  const rear = model.childrenOf('rack').filter((c) => c.rearSide);
  const filter = useExplorer((s) => s.listFilter);
  const filtering = isFiltering(filter);
  const shown = new Set(filterUnits(model, filter).map((u) => u.key));

  return (
    <nav className="rack-list" aria-label={t('list.label')}>
      <ListFilters shown={shown.size} />
      <h2>{t('list.front')}</h2>
      {shown.size === 0 && <p className="muted list-filter-empty">{t('listFilter.empty')}</p>}
      {groups.map((g, gi) => {
        const c = model.getComponent(g.component);
        const name = i18n.name(g.component);
        const units = model.rackUnits.filter((u) => u.group === gi && shown.has(u.key));
        if (units.length === 0) return null;
        return (
          <section key={gi}>
            <h3>
              <span className="swatch" style={{ background: TYPE_COLORS[c?.type ?? 'rack'] }} aria-hidden="true" />
              {t('list.group', { count: g.count, name })}
            </h3>
            <ul>
              {units.map((u) => (
                <li key={u.key}>
                  <button
                    type="button"
                    aria-current={current === u.key ? 'true' : undefined}
                    ref={current === u.key ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                    className={current === u.key ? 'selected' : undefined}
                    onClick={() => select(u.key)}
                  >
                    {t('list.unit', { name, index: u.index })}
                    <span className="muted"> · {t('list.height', { height: u.heightRU })}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!filtering && <h2>{t('list.rear')}</h2>}
      {!filtering && <ul>
        {rear.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              aria-current={current === c.id ? 'true' : undefined}
              className={current === c.id ? 'selected' : undefined}
              onClick={() => select(c.id)}
            >
              {i18n.name(c.id)}
            </button>
          </li>
        ))}
      </ul>}
      <p className="muted small">{t('list.only3d')}</p>
      {totals && <RackTotals level={2} />}
    </nav>
  );
}

/**
 * Chips that narrow the list: by rack unit type and by network. Several chips
 * in one row widen it (OR); the two rows narrow each other (AND). A network
 * chip only filters the list; the 3D overlay keeps its own choice.
 */
function ListFilters({ shown }: { shown: number }) {
  const filter = useExplorer((s) => s.listFilter);
  const toggleType = useExplorer((s) => s.toggleListType);
  const toggleNet = useExplorer((s) => s.toggleListNet);
  const clear = useExplorer((s) => s.clearListFilter);
  const i18n = useI18n();
  const { t } = i18n;
  return (
    <div className="list-filter" role="group" aria-label={t('listFilter.label')}>
      <div className="list-filter-row" role="group" aria-label={t('listFilter.byType')}>
        <span className="muted small">{t('listFilter.type')}</span>
        {filterTypes(model).map((id) => {
          const c = model.getComponent(id);
          return (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={filter.types.includes(id)}
              onClick={() => toggleType(id)}
              style={{ ['--net' as string]: TYPE_COLORS[c?.type ?? 'rack'] }}
            >
              <span className="net-dot" aria-hidden="true" />
              {i18n.name(id)}
            </button>
          );
        })}
      </div>
      <div className="list-filter-row" role="group" aria-label={t('listFilter.byNetwork')}>
        <span className="muted small">{t('listFilter.network')}</span>
        {filterNetworks(model).map((id) => {
          const n = model.getNetwork(id)!;
          return (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={filter.nets.includes(id)}
              title={i18n.network(id, 'description', n.description)}
              onClick={() => toggleNet(id)}
              style={{ ['--net' as string]: NETWORK_COLORS[id] ?? '#ffffff' }}
            >
              <span className="net-dot" aria-hidden="true" />
              {n.number} {n.name}
            </button>
          );
        })}
      </div>
      <div className="list-filter-status">
        <span role="status" aria-live="polite" className="muted small">
          {t('listFilter.count', { shown, total: model.rackUnits.length })}
        </span>
        {isFiltering(filter) && (
          <button type="button" className="link-button" onClick={clear}>
            {t('listFilter.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
