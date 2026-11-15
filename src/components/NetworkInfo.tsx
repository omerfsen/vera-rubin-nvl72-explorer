import { model } from '../data';
import { CONFLICT_COLOR, NETWORK_COLORS } from '../scenes/geometry';
import { useExplorer } from '../state/store';

/** What the active network is and what sits on it, with counts per rack where the guide gives them. */
export function NetworkInfo() {
  const network = useExplorer((s) => s.network);
  const setNetwork = useExplorer((s) => s.setNetwork);
  const select = useExplorer((s) => s.select);
  const n = network ? model.getNetwork(network) : undefined;
  if (!n) return null;
  const { members } = model.networkMembers(n.id);
  const items = [...members.entries()].map(([id, m]) => ({ c: model.getComponent(id)!, ...m }));
  return (
    <section className="network-info" style={{ borderColor: NETWORK_COLORS[n.id] }} aria-label={`Network ${n.name}`}>
      <h3>
        Network {n.number}: {n.name}
        {n.fabric ? ` · ${n.fabric}` : ''}
      </h3>
      <p>{n.description}</p>
      {n.note && <p className="note">{n.note}</p>}
      {items.length === 0 ? (
        <p className="note">
          No port in this rack is on {n.name} in NVIDIA's documentation. It connects head nodes and control plane nodes
          outside the rack.
        </p>
      ) : (
        <ul className="plain">
          {items.map(({ c, alternative }) => {
            const parent = c.parent && c.parent !== 'rack' ? model.getComponent(c.parent) : undefined;
            const total = model.totalPerRack(c.id);
            return (
              <li key={c.id}>
                <button type="button" className="link-button" onClick={() => select(model.pathForComponent(c.id))}>
                  {c.name}
                </button>
                {parent && <span className="muted"> on the {parent.name}</span>}
                <span className="muted"> · {total === null ? 'count not stated' : `${total} per rack`}</span>
                {alternative && (
                  <div className="note" style={{ color: CONFLICT_COLOR }}>
                    Conflict: the guide's figure puts this port on {n.name}, its table does not. See OPEN_QUESTIONS item 3.
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="link-button" onClick={() => setNetwork(n.id)}>
        Turn the overlay off
      </button>
    </section>
  );
}
