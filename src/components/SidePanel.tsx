import { useEffect, useRef } from 'react';
import { model } from '../data';
import type { Component, Connection, Source, Spec } from '../data/types';
import { SHOW_OFFICIAL_FIGURES, officialFigureUrl } from '../config/flags';
import { useExplorer } from '../state/store';
import { ROOT_ID } from '../data/model';
import { trayKeyOf } from '../state/url';
import { LINK_COLORS, LINK_NAMES } from '../scenes/geometry';

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

/** The other end of a connection, unless the description already names it. */
function connectionText(c: Connection, selfId: string): string {
  const other = c.from === selfId ? c.to : c.from;
  const parts: string[] = [];
  if (other) parts.push(model.getComponent(other)?.name ?? other);
  if (c.network) parts.push(model.getNetwork(c.network)?.name ?? c.network);
  return parts.filter((p) => !c.description.includes(p)).join(' · ');
}

/** "compute tray", "power shelf": generic unit names read better lowercased; product names keep their case. */
function perLabel(parent: Component): string {
  const generic: Partial<Record<Component['type'], string>> = {
    rack: 'rack',
    'compute-tray': 'compute tray',
    'switch-tray': 'switch tray',
    'power-shelf': 'power shelf',
    'tor-switch': 'top-of-rack switch',
  };
  return generic[parent.type] ?? parent.name;
}

function countText(c: Component, index: number | undefined): string[] {
  const lines: string[] = [];
  const parent = c.parent ? model.getComponent(c.parent) : undefined;
  if (c.count === null) {
    lines.push('The guide does not state how many.');
  } else if (parent) {
    lines.push(`${c.count} per ${perLabel(parent)}`);
  } else {
    lines.push('One rack: 72 GPUs in a single NVLink domain.');
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
  const view = useExplorer((s) => s.view);
  const openTray = useExplorer((s) => s.openTray);
  const trayKey = trayKeyOf(selected, model);
  const trayId = trayKey?.split('.')[0] ?? null;
  const layout = trayId ? model.trayLayout(trayId) : undefined;
  const within = trayKey && selected.startsWith(`${trayKey}/`) ? selected.slice(trayKey.length + 1) : null;
  const slot = trayId && within ? model.slotFor(trayId, within) : undefined;
  const notPlaced = layout?.notPlaced?.find((n) => n.component === component.id);
  const trayLinks = trayId && within ? model.linksAt(trayId, within) : [];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // After a selection made from a control that then disappears (a breadcrumb
  // step, a part button, a search result), focus would fall to <body>.
  // Move it to the new heading instead so keyboard users stay in place.
  useEffect(() => {
    // Leave focus alone on page load; only follow navigation the user makes.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) headingRef.current?.focus({ preventScroll: true });
  }, [selected]);

  return (
    <article className="panel-body" aria-labelledby="panel-title">
      <p className="sr-only" aria-live="polite">
        Selected: {title}
      </p>
      <header className="panel-header">
        <p className="kind">{component.type.replace(/-/g, ' ')}</p>
        <h2 id="panel-title" ref={headingRef} tabIndex={-1}>
          {title} {component.assumed && <Assumed note={component.note} />}
        </h2>
      </header>

      {trayKey && selected === trayKey && view === 'rack' && (
        <p>
          <button type="button" className="open-tray" onClick={openTray}>
            Open {title} to see its parts
          </button>
        </p>
      )}

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
        {isNumberedUnit && numbering?.overrides?.[component.id] ? (
          <p className="note">
            {numbering.overrides[component.id]!.note} Source: <SourceLink source={numbering.overrides[component.id]!.source} />
          </p>
        ) : (
          isNumberedUnit &&
          numbering?.assumed && (
            <p className="note">
              <Assumed note={numbering.note} /> {numbering.note}
            </p>
          )
        )}
        {height?.assumed && (
          <p className="note">
            <Assumed note={height.note} /> {height.note}
          </p>
        )}
      </section>

      {within && layout && (
        <section>
          <h3>Position</h3>
          {slot?.label && <p>NVIDIA label: {slot.label}</p>}
          {slot && (
            <p className="note">
              {layout.assumed && <Assumed note={layout.note} />} {layout.note}
            </p>
          )}
          {!slot && notPlaced && <p className="note">Not drawn: {notPlaced.reason}</p>}
          {!slot && !notPlaced && <p className="muted">Not drawn on its own in the 3D view.</p>}
        </section>
      )}

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
                {!ownNetworks.has(n.id) && <span className="sr-only"> (through a part inside)</span>}
              </li>
            ))}
          </ul>
        )}
        {networks.some((n) => !ownNetworks.has(n.id)) && (
          <p className="muted small">Dashed chips: reached through a part inside it.</p>
        )}
        {networks.length > 0 && (
          <details className="net-details">
            <summary>What these networks do</summary>
            <dl>
              {networks.map((n) => (
                <div key={n.id}>
                  <dt>
                    {n.number}. {n.name}
                  </dt>
                  <dd>
                    {n.description}
                    {n.note && <span className="note"> {n.note}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
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

      {trayLinks.length > 0 && trayId && within && (
        <section>
          <h3>Inside the tray, connected to</h3>
          <ul className="plain">
            {trayLinks.map((l, i) => {
              const fromHere = model.linkEndPath(trayId, l.from)?.replace(/\.\d+$/, '') === within.replace(/\.\d+$/, '');
              const other = fromHere ? l.to : l.from;
              const otherPath = model.linkEndPath(trayId, other);
              return (
                <li key={i}>
                  <span className="conn-kind" style={{ borderColor: LINK_COLORS[l.kind] }}>
                    {LINK_NAMES[l.kind] ?? l.kind}
                  </span>{' '}
                  {otherPath ? (
                    <button type="button" className="link-button" onClick={() => select(`${trayKey}/${otherPath}`)}>
                      {model.linkEndLabel(trayId, other)}
                    </button>
                  ) : (
                    model.linkEndLabel(trayId, other)
                  )}{' '}
                  {l.assumed && <Assumed note={l.note} />}
                  {l.note && <div className="note">{l.note}</div>}
                  <div className="spec-source">
                    Source: <SourceLink source={l.source} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {connections.length > 0 && (
        <section>
          <h3>Connections</h3>
          <ul className="plain">
            {connections.map((c) => (
              <li key={c.id}>
                <span className="conn-kind">{c.kind}</span> {c.description}
                {connectionText(c, component.id) && <span className="muted"> ({connectionText(c, component.id)})</span>}
                {c.assumed && <Assumed note={c.note} />}
                {c.note && <div className="note">{c.note}</div>}
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

      {component.note && (
        <section>
          <h3>Note</h3>
          <p className="note">
            {component.assumed && <Assumed note={component.note} />} {component.note}
          </p>
        </section>
      )}

      <section>
        <h3>Source</h3>
        <p>
          <SourceLink source={component.source} />
        </p>
        {component.textSources && component.textSources.length > 0 && (
          <p className="small">
            Also from:{' '}
            {component.textSources.map((s, i) => (
              <span key={`${s.url}|${s.section}`}>
                {i > 0 && ' · '}
                <SourceLink source={s} />
              </span>
            ))}
          </p>
        )}
        <p className="muted small">
          {component.source.url.includes('dgxvr-service-manual')
            ? `${model.topology.meta.serviceManual?.title}, ${model.topology.meta.serviceManual?.date}.`
            : `${model.topology.meta.document.title}, ${model.topology.meta.document.date}.`}
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
