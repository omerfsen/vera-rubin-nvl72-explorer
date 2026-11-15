import { model } from '../data';
import { NETWORK_COLORS } from '../scenes/geometry';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';

/** The seven networks as toggle chips; the active one is highlighted across the rack and inside trays. */
export function NetworkBar() {
  const network = useExplorer((s) => s.network);
  const setNetwork = useExplorer((s) => s.setNetwork);
  const i18n = useI18n();
  return (
    <div className="network-bar" role="group" aria-label={i18n.t('networkBar.label')}>
      <span className="muted small">{i18n.t('networkBar.networks')}</span>
      {model.topology.networks.map((n) => (
        <button
          key={n.id}
          type="button"
          aria-pressed={network === n.id}
          title={i18n.network(n.id, 'description', n.description)}
          onClick={() => setNetwork(n.id)}
          style={{ ['--net' as string]: NETWORK_COLORS[n.id] ?? '#ffffff' }}
        >
          <span className="net-dot" aria-hidden="true" />
          {n.number} {n.name}
        </button>
      ))}
    </div>
  );
}
