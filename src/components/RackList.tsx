import { model } from '../data';
import { TYPE_COLORS } from '../scenes/geometry';
import { useExplorer } from '../state/store';

/**
 * The rack as a plain list, top to bottom. It is the fallback when WebGL is
 * missing, and a keyboard and screen-reader friendly way to move around.
 */
export function RackList() {
  const selected = useExplorer((s) => s.selected);
  const select = useExplorer((s) => s.select);
  const current = selected.split('/')[0];
  const groups = model.topology.rackLayout.groups;
  const rear = model.childrenOf('rack').filter((c) => c.rearSide);

  return (
    <nav className="rack-list" aria-label="Rack units, top to bottom">
      <h2>Front, top to bottom</h2>
      {groups.map((g, gi) => {
        const c = model.getComponent(g.component);
        const units = model.rackUnits.filter((u) => u.group === gi);
        return (
          <section key={gi}>
            <h3>
              <span className="swatch" style={{ background: TYPE_COLORS[c?.type ?? 'rack'] }} aria-hidden="true" />
              {g.count} × {c?.name}
            </h3>
            <ul>
              {units.map((u) => (
                <li key={u.key}>
                  <button
                    type="button"
                    aria-pressed={current === u.key}
                    className={current === u.key ? 'selected' : undefined}
                    onClick={() => select(u.key)}
                  >
                    {c?.name} {u.index}
                    <span className="muted">
                      {' '}
                      · {u.heightRU} RU
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <h2>Rear</h2>
      <ul>
        {rear.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              aria-pressed={current === c.id}
              className={current === c.id ? 'selected' : undefined}
              onClick={() => select(c.id)}
            >
              {c.name}
            </button>
          </li>
        ))}
      </ul>
      <p className="muted small">The rear is not drawn in 3D yet.</p>
    </nav>
  );
}
