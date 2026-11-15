import { model } from '../data';
import { TYPE_COLORS } from '../scenes/geometry';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';

/**
 * The rack as a plain list, top to bottom. It is the fallback when WebGL is
 * missing, and a keyboard and screen-reader friendly way to move around.
 */
export function RackList() {
  const selected = useExplorer((s) => s.selected);
  const select = useExplorer((s) => s.select);
  const i18n = useI18n();
  const { t } = i18n;
  const current = selected.split('/')[0];
  const groups = model.topology.rackLayout.groups;
  const rear = model.childrenOf('rack').filter((c) => c.rearSide);

  return (
    <nav className="rack-list" aria-label={t('list.label')}>
      <h2>{t('list.front')}</h2>
      {groups.map((g, gi) => {
        const c = model.getComponent(g.component);
        const name = i18n.name(g.component);
        const units = model.rackUnits.filter((u) => u.group === gi);
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
      <h2>{t('list.rear')}</h2>
      <ul>
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
      </ul>
      <p className="muted small">{t('list.rearNotDrawn')}</p>
    </nav>
  );
}
