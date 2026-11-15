import { model } from '../data';
import { CONFLICT_COLOR, NETWORK_COLORS } from '../scenes/geometry';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';

/** What the active network is and what sits on it, with counts per rack where the guide gives them. */
export function NetworkInfo() {
  const network = useExplorer((s) => s.network);
  const setNetwork = useExplorer((s) => s.setNetwork);
  const select = useExplorer((s) => s.select);
  const i18n = useI18n();
  const { t } = i18n;
  const n = network ? model.getNetwork(network) : undefined;
  if (!n) return null;
  const { members } = model.networkMembers(n.id);
  const items = [...members.entries()].map(([id, m]) => ({ c: model.getComponent(id)!, ...m }));
  return (
    <section className="network-info" style={{ borderColor: NETWORK_COLORS[n.id] }} aria-label={t('network.aria', { name: n.name })}>
      <h3>
        {t('network.title', { number: n.number, name: n.name })}
        {n.fabric ? ` · ${n.fabric}` : ''}
      </h3>
      <p>{i18n.network(n.id, 'description', n.description)}</p>
      {n.note && <p className="note">{i18n.network(n.id, 'note', n.note)}</p>}
      {items.length === 0 ? (
        <p className="note">{t('network.noPort', { name: n.name })}</p>
      ) : (
        <ul className="plain">
          {items.map(({ c, alternative }) => {
            const parent = c.parent && c.parent !== 'rack' ? model.getComponent(c.parent) : undefined;
            const total = model.totalPerRack(c.id);
            return (
              <li key={c.id}>
                <button type="button" className="link-button" onClick={() => select(model.pathForComponent(c.id))}>
                  {i18n.name(c.id)}
                </button>
                {parent && <span className="muted">{t('network.onThe', { parent: i18n.name(parent.id) })}</span>}
                <span className="muted"> · {total === null ? t('panel.countNotStated') : t('network.perRack', { total })}</span>
                {alternative && (
                  <div className="note" style={{ color: CONFLICT_COLOR }}>
                    {t('network.conflict', { name: n.name })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="link-button" onClick={() => setNetwork(n.id)}>
        {t('network.off')}
      </button>
    </section>
  );
}
