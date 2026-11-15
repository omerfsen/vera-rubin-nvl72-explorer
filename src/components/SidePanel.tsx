import { model } from '../data';
import type { Component, Connection, Source, Spec } from '../data/types';
import { SHOW_OFFICIAL_FIGURES, officialFigureUrl } from '../config/flags';
import { useExplorer } from '../state/store';
import { ROOT_ID } from '../data/model';

function SourceLink({ source }: { source: Source }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer">
      {source.section}
    </a>
  );
}

function Assumed({ note }: { note?: string }) {
  return (
    <span className="assumed" title={note}>
      assumed
    </span>
  );
}

function SpecRow({ spec, component }: { spec: Spec; component: Component }) {
  const value = `${spec.value}${spec.unit ? ` ${spec.unit}` : ''}`;
  const differentSource = spec.source && spec.source.url + spec.source.section !== component.source.url + component.source.section;
  return (
    <tr>
      <th scope="row">{spec.label}</th>
      <td>
        {value} {spec.assumed && <Assumed note={spec.note} />}
        {spec.note && <div className="note">{spec.note}</div>}
        {differentSource && spec.source && (
          <div className="spec-source">
            Source: <SourceLink source={spec.source} />
          </div>
        )}
      </td>
    </tr>
  );
}

function connectionText(c: Connection, selfId: string): string {
  const other = c.from === selfId ? c.to : c.from;
  const parts: string[] = [];
  if (other) parts.push(model.getComponent(other)?.name ?? other);
  if (c.network) parts.push(model.getNetwork(c.network)?.name ?? c.network);
  return parts.join(' · ');
}

function countText(c: Component, index: number | undefined): string[] {
  const lines: string[] = [];
  const parent = c.parent ? model.getComponent(c.parent) : undefined;
  if (c.count === null) {
    lines.push('The guide does not state how many.');
  } else if (parent) {
    lines.push(`${c.count} per ${parent.id === ROOT_ID ? 'rack' : parent.name.toLowerCase()}`);
  } else {
    lines.push(`${c.count}`);
  }
  const total = model.totalPerRack(c.id);
  if (total !== null && parent && parent.id !== ROOT_ID) lines.push(`${total} per rack (computed)`);
  if (index !== undefined) lines.push(`This is number ${index}.`);
  return lines;
}

export function SidePanel() {
  const selected = useExplorer((s) => s.selected);
  const select = useExplorer((s) => s.select);
  const segments = model.parsePath(selected) ?? [];
  const last = segments[segments.length - 1];
  const component = model.getComponent(last?.id ?? ROOT_ID)!;
  const title = last ? model.segmentLabel(last) : component.name;
  const children = model.childrenOf(component.id);
  const connections = model.connectionsOf(component.id);
  const networks = model.networksWithin(component.id);
  const ownNetworks = new Set(component.networks);
  const numbering = model.topology.rackLayout.numbering;
  const isNumberedUnit = last?.index !== undefined && segments.length === 1 && model.isRackUnitType(component.id);
  const height = model.isRackUnitType(component.id) ? model.topology.rackLayout.heightsRU?.[component.id] : undefined;

  return (
    <article className="panel-body" aria-live="polite">
      <header className="panel-header">
        <p className="kind">{component.type.replace(/-/g, ' ')}</p>
        <h2>
          {title} {component.assumed && <Assumed note={component.note} />}
        </h2>
      </header>

      <section>
        <h3>What it is</h3>
        <p>{component.description}</p>
      </section>

      <section>
        <h3>What it does</h3>
        <p>{component.function}</p>
      </section>

      <section>
        <h3>How many</h3>
        {countText(component, last?.index).map((line) => (
          <p key={line}>{line}</p>
        ))}
        {isNumberedUnit && numbering?.assumed && (
          <p className="note">
            <Assumed note={numbering.note} /> {numbering.note}
          </p>
        )}
        {height?.assumed && (
          <p className="note">
            <Assumed note={height.note} /> {height.note}
          </p>
        )}
      </section>

      <section>
        <h3>Networks</h3>
        {networks.length === 0 ? (
          <p className="muted">Not on any of the seven rack networks.</p>
        ) : (
          <ul className="chips">
            {networks.map((n) => (
              <li key={n.id} className={ownNetworks.has(n.id) ? 'chip' : 'chip chip-sub'} title={n.description}>
                <span className="chip-num">{n.number}</span> {n.name}
                {n.fabric ? <span className="chip-fabric"> · {n.fabric}</span> : null}
              </li>
            ))}
          </ul>
        )}
        {networks.some((n) => !ownNetworks.has(n.id)) && (
          <p className="muted small">Lighter chips: reached through a part inside it.</p>
        )}
      </section>

      {component.specs.length > 0 && (
        <section>
          <h3>Specs</h3>
          <table className="specs">
            <tbody>
              {component.specs.map((s) => (
                <SpecRow key={s.label} spec={s} component={component} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      {connections.length > 0 && (
        <section>
          <h3>Connections</h3>
          <ul className="plain">
            {connections.map((c) => (
              <li key={c.id}>
                <span className="conn-kind">{c.kind}</span> {c.description}
                <span className="muted"> ({connectionText(c, component.id)})</span>
                <div className="spec-source">
                  Source: <SourceLink source={c.source} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {children.length > 0 && (
        <section>
          <h3>Parts inside</h3>
          <ul className="parts">
            {children.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() =>
                    select(component.id === ROOT_ID ? model.pathForComponent(child.id) : `${selected}/${child.id}`)
                  }
                >
                  <span>{child.name}</span>
                  <span className="muted">{child.count === null ? 'count not stated' : `× ${child.count}`}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {component.note && !component.assumed && (
        <section>
          <h3>Note</h3>
          <p className="note">{component.note}</p>
        </section>
      )}

      <section>
        <h3>Source</h3>
        <p>
          <SourceLink source={component.source} />
        </p>
        <p className="muted small">
          {model.topology.meta.document.title}, {model.topology.meta.document.date}.
        </p>
        {SHOW_OFFICIAL_FIGURES && component.source.figure && (
          <figure className="official-figure">
            <img
              src={officialFigureUrl(component.source.figure)}
              alt={`Official figure for ${component.name}, from the NVIDIA DGX VR NVL72 User Guide`}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <figcaption>Figure hot-linked from docs.nvidia.com. © NVIDIA Corporation.</figcaption>
          </figure>
        )}
      </section>
    </article>
  );
}
