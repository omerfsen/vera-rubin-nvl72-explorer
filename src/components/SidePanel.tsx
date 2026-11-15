import { useEffect, useRef } from 'react';
import { model } from '../data';
import type { Component, Connection, Source, Spec } from '../data/types';
import { SHOW_OFFICIAL_FIGURES, officialFigureUrl } from '../config/flags';
import { useExplorer } from '../state/store';
import { ROOT_ID } from '../data/model';
import { trayKeyOf } from '../state/url';
import { NetworkInfo } from './NetworkInfo';
import { HostView } from './HostView';
import { ProcedureBox, ProcedureStart } from './Procedure';
import { Share } from './Share';
import { CommandsSection, SafetySection, SoftwareSection } from './Operations';
import { LINK_COLORS } from '../scenes/geometry';
import { useI18n, type I18n } from '../i18n';

function SourceLink({ source }: { source: Source }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer">
      {source.section}
    </a>
  );
}

function Assumed({ note }: { note?: string }) {
  const { t } = useI18n();
  return (
    <span className="assumed" title={note}>
      {t('panel.assumed')}
    </span>
  );
}

function SpecRow({ spec, component }: { spec: Spec; component: Component }) {
  const i18n = useI18n();
  const note = i18n.specNote(component.id, spec.label, spec.note);
  const value = `${spec.value}${spec.unit ? ` ${spec.unit}` : ''}`;
  const differentSource = spec.source && spec.source.url + spec.source.section !== component.source.url + component.source.section;
  return (
    <tr>
      <th scope="row">{i18n.specLabel(spec.label)}</th>
      <td>
        {value} {spec.assumed && <Assumed note={note} />}
        {note && <div className="note">{note}</div>}
        {differentSource && spec.source && (
          <div className="spec-source">
            {i18n.t('panel.sourceLabel')} <SourceLink source={spec.source} />
          </div>
        )}
      </td>
    </tr>
  );
}

/** Every section of NVIDIA's documents about this part, with the HTML section, the PDF page and figure links. */
function Documents({ component }: { component: Component }) {
  const { t } = useI18n();
  if (component.references.length === 0) return null;
  return (
    <section>
      <h3>{t('panel.documents')}</h3>
      <ul className="plain doc-list">
        {component.references.map((r) => (
          <li key={`${r.document}|${r.section}`}>
            <span className="muted">{t(`docs.${r.document}`)}</span> {r.section}:{' '}
            <a href={r.html} target="_blank" rel="noopener noreferrer">
              {t('panel.web')}
            </a>
            {r.pdf && (
              <>
                {' · '}
                <a href={r.pdf} target="_blank" rel="noopener noreferrer">
                  {t('panel.pdfPage', { page: r.pdf.split('#page=')[1] ?? '' })}
                </a>
              </>
            )}
            {(r.figures ?? []).map((f) => (
              <span key={f}>
                {' · '}
                <a href={f} target="_blank" rel="noopener noreferrer">
                  {t('panel.figure')}
                </a>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Open questions in NVIDIA's documents that involve this part. */
function OpenQuestions({ component }: { component: Component }) {
  const i18n = useI18n();
  const { t } = i18n;
  const qs = (model.topology.openQuestions ?? []).filter((q) => q.components.includes(component.id));
  if (qs.length === 0) return null;
  return (
    <section className="open-questions">
      <h3>{qs.length > 1 ? t('panel.openQuestions') : t('panel.openQuestion')}</h3>
      {qs.map((q) => (
        <p key={q.id}>
          <span className={q.kind === 'conflict' ? 'assumed' : 'gap-badge'}>{t(`badge.${q.kind}`)}</span>{' '}
          <strong>{i18n.question(q.id, 'title', q.title)}.</strong> {i18n.question(q.id, 'summary', q.summary)}
        </p>
      ))}
    </section>
  );
}

/** The other end of a connection, unless the description already names it. */
function connectionText(c: Connection, selfId: string, i18n: I18n): string {
  const other = c.from === selfId ? c.to : c.from;
  const description = i18n.connection(c.id, 'description', c.description);
  const parts: string[] = [];
  if (other) parts.push(i18n.name(other));
  if (c.network) parts.push(model.getNetwork(c.network)?.name ?? c.network);
  return parts.filter((p) => !description.includes(p) && !c.description.includes(p)).join(' · ');
}

/** "compute tray", "power shelf": generic unit names read better lowercased; product names keep their case. */
function perLabel(parent: Component, i18n: I18n): string {
  const generic = ['rack', 'compute-tray', 'switch-tray', 'power-shelf', 'tor-switch'];
  return generic.includes(parent.type) ? i18n.t(`per.${parent.type}`) : i18n.name(parent.id);
}

function countText(c: Component, index: number | undefined, i18n: I18n): string[] {
  const { t } = i18n;
  const lines: string[] = [];
  const parent = c.parent ? model.getComponent(c.parent) : undefined;
  if (c.count === null) {
    lines.push(t('count.notStated'));
  } else if (parent) {
    lines.push(t('count.perParent', { count: c.count, parent: perLabel(parent, i18n) }));
  } else {
    const gpus = c.specs.find((s) => s.label === 'GPUs in the NVLink domain')?.value;
    lines.push(gpus ? t('count.oneRack', { gpus }) : `${c.count}`);
  }
  const total = model.totalPerRack(c.id);
  if (total !== null && parent && parent.id !== ROOT_ID) lines.push(t('count.perRack', { total }));
  if (index !== undefined) lines.push(t('count.thisIs', { index }));
  return lines;
}

export function SidePanel() {
  const selected = useExplorer((s) => s.selected);
  const select = useExplorer((s) => s.select);
  const i18n = useI18n();
  const { t } = i18n;
  const segments = model.parsePath(selected) ?? [];
  const last = segments[segments.length - 1];
  const component = model.getComponent(last?.id ?? ROOT_ID)!;
  const title = last ? i18n.segmentLabel(last) : i18n.name(component.id);
  const note = i18n.component(component, 'note');
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
        {t('panel.selected', { title })}
      </p>
      {i18n.lang !== 'en' && (
        <p className="note translated-notice" lang={i18n.lang}>
          {t('language.translated')}
        </p>
      )}
      <ProcedureBox />
      <NetworkInfo />
      <header className="panel-header">
        <p className="kind">{i18n.typeName(component.type)}</p>
        <h2 id="panel-title" ref={headingRef} tabIndex={-1}>
          {title} {component.assumed && <Assumed note={note} />}
        </h2>
      </header>

      {trayKey && selected === trayKey && view === 'rack' && (
        <p>
          <button type="button" className="open-tray" onClick={openTray}>
            {t('panel.openToSee', { title })}
          </button>
        </p>
      )}

      <OpenQuestions component={component} />

      <section>
        <h3>{t('panel.whatItIs')}</h3>
        <p>{i18n.component(component, 'description')}</p>
      </section>

      <section>
        <h3>{t('panel.whatItDoes')}</h3>
        <p>{i18n.component(component, 'function')}</p>
      </section>

      <section>
        <h3>{t('panel.howMany')}</h3>
        {countText(component, last?.index, i18n).map((line) => (
          <p key={line}>{line}</p>
        ))}
        {isNumberedUnit && numbering?.overrides?.[component.id] ? (
          <p className="note">
            {i18n.overrideNote(component.id, numbering.overrides[component.id]!.note)} {t('panel.sourceLabel')} <SourceLink source={numbering.overrides[component.id]!.source} />
          </p>
        ) : (
          isNumberedUnit &&
          numbering?.assumed && (
            <p className="note">
              <Assumed note={i18n.numberingNote(numbering.note)} /> {i18n.numberingNote(numbering.note)}
            </p>
          )
        )}
        {height?.assumed && (
          <p className="note">
            <Assumed note={i18n.heightNote(component.id, height.note)} /> {i18n.heightNote(component.id, height.note)}
          </p>
        )}
      </section>

      {component.rearSide && model.topology.rearLayout && (
        <section>
          <h3>{t('panel.position')}</h3>
          <p className="note">
            {model.topology.rearLayout.assumed && <Assumed note={i18n.rearNote(model.topology.rearLayout.note)} />}{' '}
            {i18n.rearNote(model.topology.rearLayout.note)}
          </p>
        </section>
      )}

      {within && layout && (
        <section>
          <h3>{t('panel.position')}</h3>
          {slot?.label && <p>{t('panel.nvidiaLabel', { label: slot.label })}</p>}
          {slot && (
            <p className="note">
              {layout.assumed && <Assumed note={i18n.trayNote(trayId!, layout.note)} />} {i18n.trayNote(trayId!, layout.note)}
            </p>
          )}
          {!slot && notPlaced && (
            <p className="note">{t('panel.notDrawnReason', { reason: i18n.notPlaced(trayId!, notPlaced.component, notPlaced.reason) })}</p>
          )}
          {!slot && !notPlaced && <p className="muted">{t('panel.notDrawn')}</p>}
        </section>
      )}

      <section>
        <h3>{t('panel.networks')}</h3>
        {networks.length === 0 ? (
          <p className="muted">{t('panel.noNetworks')}</p>
        ) : (
          <ul className="chips">
            {networks.map((n) => (
              <li key={n.id} className={ownNetworks.has(n.id) ? 'chip' : 'chip chip-sub'} title={i18n.network(n.id, 'description', n.description)}>
                <span className="chip-num">{n.number}</span> {n.name}
                {n.fabric ? <span className="chip-fabric"> · {n.fabric}</span> : null}
                {!ownNetworks.has(n.id) && <span className="sr-only">{t('panel.throughPart')}</span>}
              </li>
            ))}
          </ul>
        )}
        {networks.some((n) => !ownNetworks.has(n.id)) && (
          <p className="muted small">{t('panel.dashedChips')}</p>
        )}
        {networks.length > 0 && (
          <details className="net-details">
            <summary>{t('panel.whatNetworksDo')}</summary>
            <dl>
              {networks.map((n) => (
                <div key={n.id}>
                  <dt>
                    {t('panel.networkItem', { number: n.number, name: n.name })}
                  </dt>
                  <dd>
                    {i18n.network(n.id, 'description', n.description)}
                    {n.note && <span className="note"> {i18n.network(n.id, 'note', n.note)}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </section>

      {component.specs.length > 0 && (
        <section>
          <h3>{t('panel.specs')}</h3>
          <table className="specs">
            <tbody>
              {component.specs.map((s) => (
                <SpecRow key={s.label} spec={s} component={component} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      <HostView component={component} index={last?.index} />

      <ProcedureStart component={component} />

      <SoftwareSection component={component} />

      <CommandsSection component={component} />

      <SafetySection component={component} />

      {trayLinks.length > 0 && trayId && within && (
        <section>
          <h3>{t('panel.insideTray')}</h3>
          <ul className="plain">
            {trayLinks.map((l, i) => {
              const linkIndex = layout?.links?.indexOf(l) ?? -1;
              const linkNote = i18n.linkNote(trayId, linkIndex, l.note);
              const fromHere = model.linkEndPath(trayId, l.from)?.replace(/\.\d+$/, '') === within.replace(/\.\d+$/, '');
              const other = fromHere ? l.to : l.from;
              const otherPath = model.linkEndPath(trayId, other);
              return (
                <li key={i}>
                  <span className="conn-kind" style={{ borderColor: LINK_COLORS[l.kind] }}>
                    {i18n.linkName(l.kind)}
                  </span>{' '}
                  {otherPath ? (
                    <button type="button" className="link-button" onClick={() => select(`${trayKey}/${otherPath}`)}>
                      {i18n.linkEndLabel(trayId, other)}
                    </button>
                  ) : (
                    i18n.linkEndLabel(trayId, other)
                  )}{' '}
                  {l.assumed && <Assumed note={linkNote} />}
                  {linkNote && <div className="note">{linkNote}</div>}
                  <div className="spec-source">
                    {t('panel.sourceLabel')} <SourceLink source={l.source} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {connections.length > 0 && (
        <section>
          <h3>{t('panel.connections')}</h3>
          <ul className="plain">
            {connections.map((c) => (
              <li key={c.id}>
                <span className="conn-kind">{t(`connectionKinds.${c.kind}`)}</span> {i18n.connection(c.id, 'description', c.description)}
                {connectionText(c, component.id, i18n) && <span className="muted"> ({connectionText(c, component.id, i18n)})</span>}
                {c.assumed && <Assumed note={i18n.connection(c.id, 'note', c.note)} />}
                {c.note && <div className="note">{i18n.connection(c.id, 'note', c.note)}</div>}
                <div className="spec-source">
                  {t('panel.sourceLabel')} <SourceLink source={c.source} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {children.length > 0 && (
        <section>
          <h3>{t('panel.partsInside')}</h3>
          <ul className="parts">
            {children.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() =>
                    select(component.id === ROOT_ID ? model.pathForComponent(child.id) : `${selected}/${child.id}`)
                  }
                >
                  <span>{i18n.name(child.id)}</span>
                  <span className="muted">{child.count === null ? t('panel.countNotStated') : t('panel.times', { count: child.count })}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {note && (
        <section>
          <h3>{t('panel.note')}</h3>
          <p className="note">
            {component.assumed && <Assumed note={note} />} {note}
          </p>
        </section>
      )}

      <section>
        <h3>{t('panel.source')}</h3>
        <p>
          <SourceLink source={component.source} />
        </p>
        {SHOW_OFFICIAL_FIGURES && component.source.figure && (
          <figure className="official-figure">
            <img
              src={officialFigureUrl(component.source.figure)}
              alt={t('panel.figureAlt', { name: i18n.name(component.id) })}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <figcaption>{t('panel.figureCaption')}</figcaption>
          </figure>
        )}
      </section>
      <Documents component={component} />
      <Share />
    </article>
  );
}
