import { model } from '../data';
import { NETWORK_COLORS } from '../scenes/geometry';
import { useExplorer } from '../state/store';

/** The seven networks as toggle chips; the active one is highlighted across the rack and inside trays. */
export function NetworkBar() {
  const network = useExplorer((s) => s.network);
  const setNetwork = useExplorer((s) => s.setNetwork);
  return (
    <div className="network-bar" role="group" aria-label="Highlight a network">
      <span className="muted small">Networks:</span>
      {model.topology.networks.map((n) => (
        <button
          key={n.id}
          type="button"
          aria-pressed={network === n.id}
          title={n.description}
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
